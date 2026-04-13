import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [percent, setPercent] = useState(0);
  const [saved, setSaved] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

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
    window.dispatchEvent(new Event('ironcoach:imported'));
    setTimeout(() => setStatus('done'), 100);
  };

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
    <ImportContext.Provider value={{ lastImportedAt, markImportDone, startImport, cancelImport, status, setStatus, message, setMessage, percent, setPercent, saved, setSaved, totalDays, setTotalDays }}>
      {children}
    </ImportContext.Provider>
  );
}