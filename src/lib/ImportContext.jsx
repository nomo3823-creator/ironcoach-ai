import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { parseAppleHealthXML } from '@/lib/appleHealthParser';

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
    setStatus('parsing');
    setMessage('Reading file...');
    setPercent(0);
    setSaved(0);
    setTotalDays(0);
    
    try {
      // Parse Apple Health file client-side
      const parseResult = await parseAppleHealthXML(file, (progress) => {
        setPercent(Math.round(progress.percent * 0.4)); // 40% for parsing
        setMessage(progress.message);
      }, mode);
      
      if (!parseResult?.metrics || parseResult.metrics.length === 0) {
        throw new Error('No valid metrics found in file');
      }
      
      setStatus('saving');
      setMessage(`Saving ${parseResult.metrics.length} days of data...`);
      setPercent(45);
      setTotalDays(parseResult.metrics.length);
      
      // Save metrics to database
      let saved = 0;
      const batchSize = 50;
      for (let i = 0; i < parseResult.metrics.length; i += batchSize) {
        const batch = parseResult.metrics.slice(i, i + batchSize);
        await base44.entities.DailyMetrics.bulkCreate(batch);
        saved += batch.length;
        const pct = 45 + Math.round((saved / parseResult.metrics.length) * 50);
        setPercent(pct);
        setMessage(`Saved ${saved} / ${parseResult.metrics.length} days`);
        setSaved(saved);
      }
      
      // Save workouts if any
      if (parseResult.workouts?.length > 0) {
        for (let i = 0; i < parseResult.workouts.length; i += batchSize) {
          const batch = parseResult.workouts.slice(i, i + batchSize);
          await base44.entities.Activity.bulkCreate(batch);
        }
      }
      
      setPercent(100);
      setMessage('Import complete!');
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'Import failed');
      console.error('Import error:', err);
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