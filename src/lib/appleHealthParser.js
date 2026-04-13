/**
 * Streaming Apple Health XML Parser — extracts ONLY the fields the app uses:
 * HRV, resting HR, sleep (hours + deep/REM/awake/quality), SpO2, VO2 max,
 * respiratory rate, weight, active calories, and workouts.
 */

export async function parseAppleHealthXML(file, onProgress, importMode = 'smart') {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
  const fileSize = file.size;

  if (fileSize > 2 * 1024 * 1024 * 1024) {
    throw new Error('File exceeds 2GB. Please export data for the last 2 years only.');
  }

  // Calculate date cutoffs based on import mode
  const today = new Date();
  let cutoffDates = null;

  if (importMode === 'smart') {
    cutoffDates = {
      fullMetrics: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
      partialMetrics: new Date(today.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
    };
  } else if (importMode === '90days') {
    cutoffDates = {
      fullMetrics: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000),
      partialMetrics: null,
    };
  } else if (importMode === '2years') {
    cutoffDates = {
      fullMetrics: new Date(today.getTime() - 2 * 365 * 24 * 60 * 60 * 1000),
      partialMetrics: null,
    };
  }

  const metrics = {};
  const workouts = [];
  let processed = 0;
  let recordCount = 0;
  let workoutCount = 0;

  const counters = {
    hrv_records: 0,
    sleep_records: 0,
    resting_hr_records: 0,
    spo2_records: 0,
    respiratory_records: 0,
    vo2_records: 0,
    weight_records: 0,
    active_calories: 0,
    workouts: 0,
  };

  let buffer = '';

  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
    const text = await chunk.text();
    buffer += text;

    // Process complete <Record> elements (only KEPT types)
    const recordPattern = /<Record[^>]*>[\s\S]*?<\/Record>/g;
    let match;

    while ((match = recordPattern.exec(buffer)) !== null) {
      try {
        recordCount++;
        const recordXML = match[0];
        const type = extractAttr(recordXML, 'type');
        const value = extractAttr(recordXML, 'value');
        const startDate = extractAttr(recordXML, 'startDate');
        const endDate = extractAttr(recordXML, 'endDate');

        if (!startDate) continue;

        const dateStr = new Date(startDate).toLocaleDateString('en-CA');
        const recordTime = new Date(startDate).getTime();

        // Apply date filtering
        if (cutoffDates) {
          const fullMetricsTime = cutoffDates.fullMetrics.getTime();
          const keptFullTypes = ['HeartRateVariabilitySDNN', 'SleepAnalysis', 'RestingHeartRate', 'OxygenSaturation', 'RespiratoryRate', 'ActiveEnergyBurned', 'VO2Max'];
          const keptPartialTypes = ['HeartRateVariabilitySDNN', 'RestingHeartRate', 'VO2Max', 'BodyMass'];

          const isFullType = keptFullTypes.some(t => type?.includes(t));
          const isPartialType = keptPartialTypes.some(t => type?.includes(t));

          if (isFullType && recordTime < fullMetricsTime) continue;

          if (isPartialType && cutoffDates.partialMetrics) {
            const partialMetricsTime = cutoffDates.partialMetrics.getTime();
            if (recordTime < partialMetricsTime) continue;
          }
        }

        if (!metrics[dateStr]) metrics[dateStr] = { date: dateStr };

        // HRV
        if (type?.includes('HeartRateVariabilitySDNN')) {
          const hrmVal = parseFloat(value);
          if (!isNaN(hrmVal)) {
            metrics[dateStr].hrv = hrmVal;
            counters.hrv_records++;
          }
        }

        // Resting Heart Rate
        if (type?.includes('RestingHeartRate')) {
          const rhr = Math.round(parseFloat(value));
          if (!isNaN(rhr)) {
            metrics[dateStr].resting_hr = rhr;
            counters.resting_hr_records++;
          }
        }

        // Sleep Analysis (iOS 16+: AsleepDeep/REM/Core vs legacy Asleep)
        if (type?.includes('SleepAnalysis')) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const hours = (end - start) / (1000 * 60 * 60);
          const sleepVal = value;

          if (!metrics[dateStr].sleep_raw) {
            metrics[dateStr].sleep_raw = { asleep: 0, deep: 0, rem: 0, core: 0, awake: 0 };
          }

          if (sleepVal?.includes('AsleepDeep')) {
            metrics[dateStr].sleep_raw.deep += hours;
          } else if (sleepVal?.includes('AsleepREM')) {
            metrics[dateStr].sleep_raw.rem += hours;
          } else if (sleepVal?.includes('AsleepCore')) {
            metrics[dateStr].sleep_raw.core += hours;
          } else if (sleepVal?.includes('Asleep')) {
            metrics[dateStr].sleep_raw.asleep += hours;
          } else if (sleepVal?.includes('Awake')) {
            metrics[dateStr].sleep_raw.awake += hours;
          }
          counters.sleep_records++;
        }

        // SpO2
        if (type?.includes('OxygenSaturation')) {
          const spo2Val = Math.round(parseFloat(value) * 100);
          if (!isNaN(spo2Val)) {
            if (!metrics[dateStr].spo2_readings) metrics[dateStr].spo2_readings = [];
            metrics[dateStr].spo2_readings.push(spo2Val);
            counters.spo2_records++;
          }
        }

        // Respiratory Rate
        if (type?.includes('RespiratoryRate')) {
          const respVal = parseFloat(value);
          if (!isNaN(respVal)) {
            metrics[dateStr].respiratory_rate = respVal;
            counters.respiratory_records++;
          }
        }

        // Active Calories
        if (type?.includes('ActiveEnergyBurned')) {
          const cal = parseFloat(value);
          if (!isNaN(cal)) {
            metrics[dateStr].active_calories = (metrics[dateStr].active_calories || 0) + cal;
            counters.active_calories++;
          }
        }

        // VO2 Max
        if (type?.includes('VO2Max')) {
          const vo2 = parseFloat(value);
          if (!isNaN(vo2)) {
            metrics[dateStr].vo2_max = vo2;
            counters.vo2_records++;
          }
        }

        // Body Weight
        if (type?.includes('BodyMass')) {
          const weight = parseFloat(value);
          if (!isNaN(weight)) {
            metrics[dateStr].weight_kg = weight;
            counters.weight_records++;
          }
        }
      } catch (err) {
        // Skip malformed records
      }
    }

    // Process workouts from chunk
    const workoutPattern = /<Workout[^>]*>[\s\S]*?(<\/Workout>|\/>)/g;
    let wMatch;
    while ((wMatch = workoutPattern.exec(buffer)) !== null) {
      try {
        const workoutXML = wMatch[0];
        const actType = extractAttr(workoutXML, 'workoutActivityType');
        const duration = parseFloat(extractAttr(workoutXML, 'duration'));
        const distance = parseFloat(extractAttr(workoutXML, 'totalDistance'));
        const calories = parseFloat(extractAttr(workoutXML, 'totalEnergyBurned'));
        const startDate = extractAttr(workoutXML, 'startDate');
        const sourceName = extractAttr(workoutXML, 'sourceName');

        if (startDate && duration > 5) {
          // Skip workouts < 5 min
          const wDateStr = new Date(startDate).toLocaleDateString('en-CA');
          const sport = mapWorkoutType(actType);
          workouts.push({
            date: wDateStr,
            sport,
            title: actType?.replace('HKWorkoutActivityType', '') || 'Workout',
            duration_minutes: Math.round(duration),
            distance_km: isNaN(distance) ? null : Math.round((distance / 1000) * 10) / 10,
            calories: isNaN(calories) ? null : Math.round(calories),
            source: 'apple_health',
            device_name: sourceName,
            external_id: `ah_${startDate}_${actType}`,
          });
          workoutCount++;
          counters.workouts++;
        }
      } catch (err) {
        // Skip malformed workouts
      }
    }

    // Keep only the last incomplete line in buffer for next iteration
    const lastNewline = buffer.lastIndexOf('\n');
    buffer = lastNewline !== -1 ? buffer.substring(lastNewline) : '';

    processed += chunk.size;
    const pct = Math.round((processed / fileSize) * 100);
    onProgress?.({
      percent: pct,
      message: `Processing records... ${recordCount} found, ${workoutCount} workouts`,
      counters,
    });
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const recordPattern = /<Record[^>]*>[\s\S]*?<\/Record>/g;
    let match;
    while ((match = recordPattern.exec(buffer)) !== null) {
      try {
        const recordXML = match[0];
        const type = extractAttr(recordXML, 'type');
        const value = extractAttr(recordXML, 'value');
        const startDate = extractAttr(recordXML, 'startDate');
        const endDate = extractAttr(recordXML, 'endDate');

        if (!startDate) continue;

        const dateStr = new Date(startDate).toLocaleDateString('en-CA');
        if (!metrics[dateStr]) metrics[dateStr] = { date: dateStr };

        // Parse kept types (same logic as main loop, abbreviated)
        if (type?.includes('HeartRateVariabilitySDNN')) {
          const hrmVal = parseFloat(value);
          if (!isNaN(hrmVal)) metrics[dateStr].hrv = hrmVal;
        } else if (type?.includes('RestingHeartRate')) {
          const rhr = Math.round(parseFloat(value));
          if (!isNaN(rhr)) metrics[dateStr].resting_hr = rhr;
        } else if (type?.includes('SleepAnalysis')) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const hours = (end - start) / (1000 * 60 * 60);
          const sleepVal = value;
          if (!metrics[dateStr].sleep_raw) metrics[dateStr].sleep_raw = { asleep: 0, deep: 0, rem: 0, core: 0, awake: 0 };
          if (sleepVal?.includes('AsleepDeep')) metrics[dateStr].sleep_raw.deep += hours;
          else if (sleepVal?.includes('AsleepREM')) metrics[dateStr].sleep_raw.rem += hours;
          else if (sleepVal?.includes('AsleepCore')) metrics[dateStr].sleep_raw.core += hours;
          else if (sleepVal?.includes('Asleep')) metrics[dateStr].sleep_raw.asleep += hours;
          else if (sleepVal?.includes('Awake')) metrics[dateStr].sleep_raw.awake += hours;
        } else if (type?.includes('OxygenSaturation')) {
          const spo2Val = Math.round(parseFloat(value) * 100);
          if (!isNaN(spo2Val)) {
            if (!metrics[dateStr].spo2_readings) metrics[dateStr].spo2_readings = [];
            metrics[dateStr].spo2_readings.push(spo2Val);
          }
        } else if (type?.includes('RespiratoryRate')) {
          const respVal = parseFloat(value);
          if (!isNaN(respVal)) metrics[dateStr].respiratory_rate = respVal;
        } else if (type?.includes('ActiveEnergyBurned')) {
          const cal = parseFloat(value);
          if (!isNaN(cal)) metrics[dateStr].active_calories = (metrics[dateStr].active_calories || 0) + cal;
        } else if (type?.includes('VO2Max')) {
          const vo2 = parseFloat(value);
          if (!isNaN(vo2)) metrics[dateStr].vo2_max = vo2;
        } else if (type?.includes('BodyMass')) {
          const weight = parseFloat(value);
          if (!isNaN(weight)) metrics[dateStr].weight_kg = weight;
        }
      } catch (err) {
        // Skip malformed records
      }
    }

    // Process workouts from remaining buffer
    const workoutPattern = /<Workout[^>]*>[\s\S]*?(<\/Workout>|\/>)/g;
    let wMatch;
    while ((wMatch = workoutPattern.exec(buffer)) !== null) {
      try {
        const workoutXML = wMatch[0];
        const actType = extractAttr(workoutXML, 'workoutActivityType');
        const duration = parseFloat(extractAttr(workoutXML, 'duration'));
        const distance = parseFloat(extractAttr(workoutXML, 'totalDistance'));
        const calories = parseFloat(extractAttr(workoutXML, 'totalEnergyBurned'));
        const startDate = extractAttr(workoutXML, 'startDate');
        const sourceName = extractAttr(workoutXML, 'sourceName');

        if (startDate && duration > 5) {
          const wDateStr = new Date(startDate).toLocaleDateString('en-CA');
          const sport = mapWorkoutType(actType);
          workouts.push({
            date: wDateStr,
            sport,
            title: actType?.replace('HKWorkoutActivityType', '') || 'Workout',
            duration_minutes: Math.round(duration),
            distance_km: isNaN(distance) ? null : Math.round((distance / 1000) * 10) / 10,
            calories: isNaN(calories) ? null : Math.round(calories),
            source: 'apple_health',
            device_name: sourceName,
            external_id: `ah_${startDate}_${actType}`,
          });
          workoutCount++;
          counters.workouts++;
        }
      } catch (err) {
        // Skip malformed workouts
      }
    }
  }

  onProgress?.({ percent: 100, message: 'Finalizing...', counters });

  // Aggregate data
  const finalMetrics = {};
  for (const [date, m] of Object.entries(metrics)) {
    const final = { date };

    if (m.hrv) final.hrv = Math.round(m.hrv * 10) / 10;
    if (m.resting_hr) final.resting_hr = m.resting_hr;

    if (m.sleep_raw) {
      const total = m.sleep_raw.asleep > 0 ? m.sleep_raw.asleep : m.sleep_raw.deep + m.sleep_raw.rem + m.sleep_raw.core;
      final.sleep_hours = Math.round(total * 10) / 10;
      final.sleep_deep_minutes = Math.round(m.sleep_raw.deep * 60);
      final.sleep_rem_minutes = Math.round(m.sleep_raw.rem * 60);
      final.sleep_awake_minutes = Math.round(m.sleep_raw.awake * 60);

      const deepRem = m.sleep_raw.deep + m.sleep_raw.rem + m.sleep_raw.core;
      if (final.sleep_hours >= 8 && deepRem >= 1.5) {
        final.sleep_quality = 'excellent';
      } else if (final.sleep_hours >= 7 && deepRem >= 1) {
        final.sleep_quality = 'good';
      } else if (final.sleep_hours >= 6) {
        final.sleep_quality = 'fair';
      } else {
        final.sleep_quality = 'poor';
      }
    }

    if (m.spo2_readings && m.spo2_readings.length > 0) {
      final.spo2 = Math.round(m.spo2_readings.reduce((a, b) => a + b) / m.spo2_readings.length);
    }

    if (m.respiratory_rate) final.respiratory_rate = Math.round(m.respiratory_rate * 10) / 10;
    if (m.active_calories) final.active_calories = Math.round(m.active_calories);
    if (m.vo2_max) final.vo2_max = Math.round(m.vo2_max * 10) / 10;
    if (m.weight_kg) final.weight_kg = Math.round(m.weight_kg * 10) / 10;

    finalMetrics[date] = final;
  }

  return {
    metrics: Object.values(finalMetrics),
    workouts,
    counters,
    recordCount,
    workoutCount,
  };
}

function extractAttr(xml, attr) {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function mapWorkoutType(actType) {
  if (!actType) return 'other';
  if (actType.includes('Running')) return 'run';
  if (actType.includes('Cycling')) return 'bike';
  if (actType.includes('Swimming')) return 'swim';
  if (
    actType.includes('MixedCardio') ||
    actType.includes('CrossTraining') ||
    actType.includes('HighIntensityIntervalTraining')
  )
    return 'brick';
  if (actType.includes('Strength') || actType.includes('FunctionalStrength')) return 'strength';
  return 'other';
}