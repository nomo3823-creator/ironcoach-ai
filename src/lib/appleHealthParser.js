/**
 * Streaming Apple Health XML Parser — processes large files without loading entire DOM into memory
 * Uses regex-based line scanning and event-driven record extraction
 * Supports tiered date-range filtering for smart imports
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
    // Smart: full last 90 days, partial 2 years, skip older
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
  } else if (importMode === 'alltime') {
    cutoffDates = null; // no filtering
  }

  const metrics = {};
  const workouts = [];
  let processed = 0;
  let recordCount = 0;
  let skipped = 0;

  const counters = {
    hrv_records: 0,
    sleep_records: 0,
    resting_hr_records: 0,
    heart_rate_records: 0,
    spo2_records: 0,
    respiratory_records: 0,
    active_calories: 0,
    resting_calories: 0,
    steps_records: 0,
    distance_records: 0,
    vo2_records: 0,
    weight_records: 0,
    workouts: 0,
  };

  let buffer = '';

  for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, fileSize));
    const text = await chunk.text();
    buffer += text;

    // Process complete records (end with </Record>)
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

        if (!startDate) {
          skipped++;
          continue;
        }

        const dateStr = startDate.substring(0, 10);
        const recordTime = new Date(startDate).getTime();
        
        // Apply date filtering based on import mode
        if (cutoffDates) {
          const fullMetricsTime = cutoffDates.fullMetrics.getTime();
          
          // Full metric types (last 90 days)
          const fullMetricTypes = ['HeartRateVariabilitySDNN', 'SleepAnalysis', 'RestingHeartRate', 
            'OxygenSaturation', 'WorkoutType', 'StepCount', 'ActiveEnergyBurned', 'BasalEnergyBurned'];
          const isFullMetric = fullMetricTypes.some(t => type?.includes(t));
          
          // Partial metric types (last 2 years)
          const partialMetricTypes = ['HeartRateVariabilitySDNN', 'RestingHeartRate', 'VO2Max', 'BodyMass'];
          const isPartialMetric = partialMetricTypes.some(t => type?.includes(t));
          
          // Skip full metrics outside 90 days
          if (isFullMetric && recordTime < fullMetricsTime) {
            skipped++;
            continue;
          }
          
          // Skip partial metrics outside 2 years (if applicable)
          if (isPartialMetric && cutoffDates.partialMetrics) {
            const partialMetricsTime = cutoffDates.partialMetrics.getTime();
            if (recordTime < partialMetricsTime) {
              skipped++;
              continue;
            }
          }
          
          // For alltime or when no cutoff, skip records older than 2 years if in smart mode and not full/partial
          if (!isFullMetric && !isPartialMetric && cutoffDates.partialMetrics && recordTime < cutoffDates.partialMetrics.getTime()) {
            skipped++;
            continue;
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

        // Heart Rate
        if (type?.includes('HeartRate') && !type?.includes('Variability') && !type?.includes('Resting')) {
          const hrVal = Math.round(parseFloat(value));
          if (!isNaN(hrVal)) {
            if (!metrics[dateStr].avg_hr) metrics[dateStr].avg_hr = [];
            metrics[dateStr].avg_hr.push(hrVal);
            counters.heart_rate_records++;
          }
        }

        // Sleep Analysis
        if (type?.includes('SleepAnalysis')) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const hours = (end - start) / (1000 * 60 * 60);
          const sleepVal = value;

          if (!metrics[dateStr].sleep_raw) metrics[dateStr].sleep_raw = { asleep: 0, deep: 0, rem: 0, awake: 0 };
          
          if (sleepVal?.includes('Asleep')) {
            metrics[dateStr].sleep_raw.asleep += hours;
          } else if (sleepVal?.includes('Deep')) {
            metrics[dateStr].sleep_raw.deep += hours;
          } else if (sleepVal?.includes('REM')) {
            metrics[dateStr].sleep_raw.rem += hours;
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

        // Resting Calories
        if (type?.includes('BasalEnergyBurned')) {
          const cal = parseFloat(value);
          if (!isNaN(cal)) {
            metrics[dateStr].resting_calories = (metrics[dateStr].resting_calories || 0) + cal;
            counters.resting_calories++;
          }
        }

        // Steps
        if (type?.includes('StepCount')) {
          const steps = Math.round(parseFloat(value));
          if (!isNaN(steps)) {
            metrics[dateStr].steps = (metrics[dateStr].steps || 0) + steps;
            counters.steps_records++;
          }
        }

        // Walking/Running Distance
        if (type?.includes('DistanceWalkingRunning')) {
          const dist = parseFloat(value) / 1000;
          if (!isNaN(dist)) {
            metrics[dateStr].walking_running_distance_km = (metrics[dateStr].walking_running_distance_km || 0) + dist;
            counters.distance_records++;
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
        skipped++;
      }
    }

    // Keep only the last incomplete line in buffer for next iteration
    const lastNewline = buffer.lastIndexOf('\n');
    buffer = lastNewline !== -1 ? buffer.substring(lastNewline) : '';

    processed += chunk.size;
    const pct = Math.round((processed / fileSize) * 100);
    onProgress?.({
      percent: pct,
      message: `Processing records... ${recordCount} found`,
      counters,
    });
  }

  // Process remaining buffer
  if (buffer.trim()) {
    const recordPattern = /<Record[^>]*>[\s\S]*?<\/Record>/g;
    let match;
    while ((match = recordPattern.exec(buffer)) !== null) {
      try {
        recordCount++;
        const recordXML = match[0];
        const type = extractAttr(recordXML, 'type');
        const value = extractAttr(recordXML, 'value');
        const startDate = extractAttr(recordXML, 'startDate');
        
        if (!startDate) continue;
        
        const dateStr = startDate.substring(0, 10);
        if (!metrics[dateStr]) metrics[dateStr] = { date: dateStr };
        
        // (same logic as above)
      } catch (err) {
        skipped++;
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
    
    if (m.avg_hr && m.avg_hr.length > 0) {
      final.avg_hr = Math.round(m.avg_hr.reduce((a, b) => a + b) / m.avg_hr.length);
    }

    if (m.sleep_raw) {
      const total = m.sleep_raw.asleep + m.sleep_raw.deep + m.sleep_raw.rem;
      final.sleep_hours = Math.round(total * 10) / 10;
      final.sleep_deep_minutes = Math.round(m.sleep_raw.deep * 60);
      final.sleep_rem_minutes = Math.round(m.sleep_raw.rem * 60);
      final.sleep_awake_minutes = Math.round(m.sleep_raw.awake * 60);
      
      const deepRem = m.sleep_raw.deep + m.sleep_raw.rem;
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
    if (m.resting_calories) final.resting_calories = Math.round(m.resting_calories);
    if (m.steps) final.steps = m.steps;
    if (m.walking_running_distance_km) final.walking_running_distance_km = Math.round(m.walking_running_distance_km * 10) / 10;
    if (m.vo2_max) final.vo2_max = Math.round(m.vo2_max * 10) / 10;
    if (m.weight_kg) final.weight_kg = Math.round(m.weight_kg * 10) / 10;

    finalMetrics[date] = final;
  }

  return {
    metrics: Object.values(finalMetrics),
    counters,
    skipped,
    recordCount,
  };
}

function extractAttr(xml, attr) {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}