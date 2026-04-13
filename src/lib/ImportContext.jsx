import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { parseAppleHealthXML } from './appleHealthParser';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const ImportContext = createContext();

export function useImport() {
  return useContext(ImportContext);
}

export function ImportProvider({ children }) {
  const { currentUser } = useAuth();
  const [state, setState] = useState({
    status: 'idle',
    percent: 0,
    message: '',
    counters: {},
    saved: 0,
    totalDays: 0,
    errors: [],
    mode: 'smart',
    startedAt: null,
    lastCheckpointAt: null,
    lastImportedAt: null,
  });

  // Load checkpoint from localStorage on mount
  useEffect(() => {
    if (!currentUser) return;
    const checkpoint = localStorage.getItem('ah_import_checkpoint');
    if (checkpoint) {
      try {
        const parsed = JSON.parse(checkpoint);
        // If interrupted mid-parse, mark as interrupted
        if (parsed.status === 'parsing' || parsed.status === 'saving') {
          setState(prev => ({
            ...prev,
            status: 'interrupted',
            message: 'Import was interrupted — reopen Apple Health settings to retry',
            ...parsed,
          }));
        } else if (parsed.status === 'done') {
          // Clear done imports after 5s (handled by pill)
          setTimeout(() => {
            localStorage.removeItem('ah_import_checkpoint');
            setState(prev => ({ ...prev, status: 'idle' }));
          }, 5000);
        }
      } catch (e) {
        console.error('Failed to load checkpoint:', e);
      }
    }
  }, [currentUser?.email]);

  const startImport = async (file, mode) => {
    if (!currentUser?.email) return;

    setState(prev => ({
      ...prev,
      status: 'parsing',
      percent: 0,
      message: 'Preparing file...',
      counters: {},
      saved: 0,
      totalDays: 0,
      errors: [],
      mode,
      startedAt: new Date().toISOString(),
      lastCheckpointAt: new Date().toISOString(),
    }));

    try {
      let xmlFile = file;

      // Handle zip files
      if (file.name.endsWith('.zip')) {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          const xmlFileEntry = contents.file('export.xml');
          if (!xmlFileEntry) {
            throw new Error('export.xml not found in zip file.');
          }
          xmlFile = await xmlFileEntry.async('blob');
        } catch (err) {
          throw new Error('Failed to extract zip: ' + err.message);
        }
      }

      const sizeMB = (xmlFile.size / 1024 / 1024).toFixed(1);
      if (sizeMB > 2048) {
        throw new Error('File exceeds 2GB. Please export the last 2 years only.');
      }

      // Parse file
      const parseResult = await parseAppleHealthXML(
        xmlFile,
        ({ percent, message: msg, counters: cnt }) => {
          setState(prev => ({
            ...prev,
            percent,
            message: msg,
            counters: cnt,
            totalDays: Object.keys(cnt).length,
          }));
        },
        mode
      );

      // Save metrics in batches
      setState(prev => ({
        ...prev,
        status: 'saving',
        message: 'Saving to database...',
      }));

      const metrics = parseResult.metrics || [];
      const workouts = parseResult.workouts || [];
      const BATCH_SIZE = 2; // Rate limit friendly
      let saved = 0;
      const errors = [];

      for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
        const batch = metrics.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(day =>
            saveMetricDay(day, currentUser.email).then(
              () => saved++,
              err => errors.push(`${day.date}: ${err.message}`)
            )
          )
        );

        setState(prev => ({
          ...prev,
          saved,
          percent: 50 + Math.round((saved / metrics.length) * 50),
          lastCheckpointAt: new Date().toISOString(),
        }));

        // 500ms delay between batches to avoid rate limits
        if (i + BATCH_SIZE < metrics.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Save workouts with deduplication
      if (workouts.length > 0) {
        for (const workout of workouts) {
          try {
            const existing = await base44.entities.Activity.filter({
              date: workout.date,
              sport: workout.sport,
              created_by: currentUser.email,
            });
            // Check for near-duplicate (within ±2 min duration)
            const isDuplicate = existing.some(
              a => Math.abs((a.duration_minutes || 0) - (workout.duration_minutes || 0)) <= 2
            );
            if (!isDuplicate) {
              await base44.entities.Activity.create({
                ...workout,
                created_by: currentUser.email,
              });
            }
          } catch (err) {
            errors.push(`Workout ${workout.date}: ${err.message}`);
          }
        }
      }

      // Mark as done
      const checkpoint = {
        status: 'done',
        saved,
        totalDays: metrics.length,
        mode,
        startedAt: state.startedAt,
        lastImportedAt: new Date().toISOString(),
      };
      localStorage.setItem('ah_import_checkpoint', JSON.stringify(checkpoint));

      setState(prev => ({
        ...prev,
        status: 'done',
        percent: 100,
        message: `Done! Imported ${saved} days.`,
        saved,
        totalDays: metrics.length,
        errors,
        lastImportedAt: new Date().toISOString(),
      }));

      if (errors.length === 0) {
        toast.success(`✓ Imported ${saved} days of Apple Health data`);
      } else {
        toast(`Imported ${saved} days, ${errors.length} failed`, {
          description: 'Most data was saved successfully.',
        });
      }

      // Auto-clear done state after 5s
      setTimeout(() => {
        localStorage.removeItem('ah_import_checkpoint');
        setState(prev => ({ ...prev, status: 'idle' }));
      }, 5000);
    } catch (err) {
      console.error('Import error:', err);
      setState(prev => ({
        ...prev,
        status: 'error',
        message: err?.message || 'Import failed',
        errors: [err?.message],
      }));
      toast.error('Import failed', { description: err?.message });
    }
  };

  const cancelImport = () => {
    localStorage.removeItem('ah_import_checkpoint');
    setState(prev => ({
      ...prev,
      status: 'idle',
      percent: 0,
      message: '',
    }));
  };

  const resumeImport = async () => {
    // If status is 'interrupted', user must restart via the component
    setState(prev => ({
      ...prev,
      status: 'idle',
      message: '',
    }));
  };

  return (
    <ImportContext.Provider value={{ ...state, startImport, cancelImport, resumeImport }}>
      {children}
    </ImportContext.Provider>
  );
}

async function saveMetricDay(day, userEmail) {
  const existing = await base44.entities.DailyMetrics.filter({
    date: day.date,
    created_by: userEmail,
  });

  const payload = {
    ...day,
    created_by: userEmail,
    import_source: 'apple_health',
    imported_at: new Date().toISOString(),
  };

  if (existing.length > 0) {
    // Merge: only overwrite fields provided, preserve manual entries
    const merged = { ...existing[0], ...payload };
    await base44.entities.DailyMetrics.update(existing[0].id, merged);
  } else {
    await base44.entities.DailyMetrics.create(payload);
  }
}