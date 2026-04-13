import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { parseAppleHealthXML } from '@/lib/appleHealthParser';
import { useAuth } from '@/lib/AuthContext';

const ImportContext = createContext();

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) {
    throw new Error('useImport must be used within ImportProvider');
  }
  return ctx;
}

function pick(obj, keys) {
  const result = {};
  keys.forEach(key => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export function ImportProvider({ children }) {
  const { currentUser } = useAuth();
  const [lastImportedAt, setLastImportedAt] = useState(null);
  const [importVersion, setImportVersion] = useState(0);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [saved, setSaved] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [counters, setCounters] = useState({});
  const [errors, setErrors] = useState([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('ironcoach:last_import_at');
    if (stored) {
      setLastImportedAt(parseInt(stored, 10));
    }
  }, []);

  const markImportDone = () => {
    const now = Date.now();
    setLastImportedAt(now);
    localStorage.setItem('ironcoach:last_import_at', String(now));
    setImportVersion(v => v + 1); // triggers re-fetch in subscribed pages
    // Invalidate React Query cache for metrics and activities
    queryClientInstance.invalidateQueries({ queryKey: ['DailyMetrics'] });
    queryClientInstance.invalidateQueries({ queryKey: ['Activity'] });
    queryClientInstance.invalidateQueries({ queryKey: ['PlannedWorkout'] });
    window.dispatchEvent(new Event('ironcoach:imported'));
    setTimeout(() => setStatus('done'), 100);
  };

  function updateProgress(data) {
    if (data.percent !== undefined) setPercent(data.percent);
    if (data.message !== undefined) setMessage(data.message);
    if (data.counters !== undefined) setCounters(data.counters);
    if (data.saved !== undefined) setSaved(data.saved);
    if (data.errors !== undefined) setErrors(data.errors);
    if (data.totalDays !== undefined) setTotalDays(data.totalDays);
  }

  const startImport = async (file, mode) => {
    if (!currentUser?.email) {
      setStatus('error');
      setMessage('Not logged in — please refresh and try again');
      return;
    }

    setStatus('parsing');
    setMessage('Reading file...');
    setPercent(0);
    setSaved(0);
    setTotalDays(0);
    setErrors([]);

    try {
      // Step 1 — handle zip files
      let xmlFile = file;
      if (file.name?.endsWith('.zip') || file.type === 'application/zip') {
        setMessage('Extracting zip file...');
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const xmlEntry = Object.keys(contents.files).find(
          name => name.endsWith('export.xml') || (name.endsWith('.xml') && !name.includes('__MACOSX'))
        );
        if (!xmlEntry) throw new Error('No export.xml found inside zip file');
        const xmlBlob = await contents.files[xmlEntry].async('blob');
        xmlFile = new File([xmlBlob], 'export.xml', { type: 'text/xml' });
      }

      // Step 2 — parse the XML
      const parseResult = await parseAppleHealthXML(
        xmlFile,
        (progress) => {
          setPercent(Math.round(progress.percent * 0.55));
          setMessage(progress.message || 'Parsing...');
          if (progress.counters) setCounters(progress.counters);
        },
        mode
      );

      if (!parseResult?.metrics || parseResult.metrics.length === 0) {
        throw new Error('No valid health metrics found in file. Make sure you exported from Apple Health on iPhone.');
      }

      // Step 3 — filter out future dates
      const todayStr = new Date().toISOString().split('T')[0];
      const metricsToSave = parseResult.metrics.filter(m => m.date && m.date <= todayStr);

      setStatus('saving');
      setTotalDays(metricsToSave.length);
      setMessage(`Saving ${metricsToSave.length} days of metrics...`);
      setPercent(56);

      // Step 4 — save metrics with created_by, using upsert logic with rate limit handling
      let savedCount = 0;
      const importErrors = [];
      const BATCH = 5;

      for (let i = 0; i < metricsToSave.length; i += BATCH) {
        const batch = metricsToSave.slice(i, i + BATCH);

        // Process sequentially to avoid rate limits
        for (const metric of batch) {
          let existing = null;
          let record = null;
          try {
            // Check for existing record for this date + user
            existing = await base44.entities.DailyMetrics.filter({
              date: metric.date,
              created_by: currentUser.email,
            });

            // Build the record — always include created_by
            record = {
              date: metric.date,
              created_by: currentUser.email,
            };

            // Only set fields that have real positive values
            if (metric.hrv > 0) record.hrv = metric.hrv;
            if (metric.resting_hr > 0) record.resting_hr = metric.resting_hr;
            if (metric.sleep_hours > 0) {
              record.sleep_hours = metric.sleep_hours;
              record.sleep_quality = metric.sleep_quality || 'good';
            }
            if (metric.sleep_deep_minutes > 0) record.sleep_deep_minutes = metric.sleep_deep_minutes;
            if (metric.sleep_rem_minutes > 0) record.sleep_rem_minutes = metric.sleep_rem_minutes;
            if (metric.sleep_awake_minutes > 0) record.sleep_awake_minutes = metric.sleep_awake_minutes;
            if (metric.spo2 > 0) record.spo2 = metric.spo2;
            if (metric.respiratory_rate > 0) record.respiratory_rate = metric.respiratory_rate;
            if (metric.active_calories > 0) record.active_calories = metric.active_calories;
            if (metric.vo2_max > 0) record.vo2_max = metric.vo2_max;
            if (metric.weight_kg > 0) record.weight_kg = metric.weight_kg;

            if (existing && existing.length > 0) {
              // Update — preserve manually logged fields, only overwrite Apple Health fields
              await base44.entities.DailyMetrics.update(existing[0].id, record);
            } else {
              // Create new record
              await base44.entities.DailyMetrics.create(record);
            }
            savedCount++;
          } catch (err) {
            if (err.message?.includes('Rate limit')) {
              // Wait and retry once
              await new Promise(resolve => setTimeout(resolve, 2000));
              try {
                // Retry the same operation
                if (existing && existing.length > 0) {
                  await base44.entities.DailyMetrics.update(existing[0].id, record);
                } else {
                  await base44.entities.DailyMetrics.create(record);
                }
                savedCount++;
              } catch (retryErr) {
                importErrors.push(`${metric.date}: ${retryErr.message}`);
              }
            } else {
              importErrors.push(`${metric.date}: ${err.message}`);
            }
          }
        }

        // Small delay between batches to respect rate limits
        if (i + BATCH < metricsToSave.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const pct = 56 + Math.round(((i + BATCH) / metricsToSave.length) * 35);
        setPercent(Math.min(91, pct));
        setMessage(`Saved ${savedCount} / ${metricsToSave.length} days...`);
        setSaved(savedCount);
      }

      // Step 5 — save Apple Watch workouts with created_by (with rate limit handling)
      if (parseResult.workouts?.length > 0) {
        setMessage(`Saving ${parseResult.workouts.length} workouts...`);
        setPercent(92);

        for (let i = 0; i < parseResult.workouts.length; i++) {
          const workout = parseResult.workouts[i];
          try {
            const existing = await base44.entities.Activity.filter({
              external_id: workout.external_id,
              created_by: currentUser.email,
            });
            if (!existing || existing.length === 0) {
              await base44.entities.Activity.create({
                ...workout,
                created_by: currentUser.email,
              });
            }
          } catch (err) {
            if (err.message?.includes('Rate limit')) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              // Retry once
              try {
                const existing = await base44.entities.Activity.filter({
                  external_id: workout.external_id,
                  created_by: currentUser.email,
                });
                if (!existing || existing.length === 0) {
                  await base44.entities.Activity.create({
                    ...workout,
                    created_by: currentUser.email,
                  });
                }
              } catch (retryErr) {
                // Skip on second failure
              }
            }
            // Skip duplicate workouts silently
          }
          
          // Small delay every 10 workouts
          if ((i + 1) % 10 === 0 && i < parseResult.workouts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      // Step 6 — update profile
      setPercent(97);
      setMessage('Finalising...');
      try {
        const profiles = await base44.entities.AthleteProfile.filter(
          { created_by: currentUser.email },
          '-created_date',
          1
        );
        if (profiles?.[0]) {
          await base44.entities.AthleteProfile.update(profiles[0].id, {
            last_apple_health_import_date: new Date().toISOString(),
            apple_health_days_imported: savedCount,
            apple_health_connected: true,
          });
        }
      } catch (err) {
        // Non-fatal
      }

      setSaved(savedCount);
      setErrors(importErrors);
      setPercent(100);
      setMessage(`Import complete — ${savedCount} days saved`);
      setStatus('done');
      markImportDone();

    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Import failed — please try again');
      console.error('Apple Health import error:', err);
    }
  };

  const cancelImport = () => {
    setStatus('idle');
    setMessage('');
    setPercent(0);
    setSaved(0);
    setTotalDays(0);
  };

  return (
    <ImportContext.Provider value={{ lastImportedAt, importVersion, markImportDone, startImport, cancelImport, updateProgress, status, setStatus, message, setMessage, percent, setPercent, saved, setSaved, totalDays, setTotalDays, counters, setCounters, errors, setErrors }}>
      {children}
    </ImportContext.Provider>
  );
}