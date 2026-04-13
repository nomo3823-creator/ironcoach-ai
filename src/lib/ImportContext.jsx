import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import JSZip from 'jszip';
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
      const result = await base44.functions.invoke('parseAppleHealth', {
        file: file,
        mode: mode,
      });
      
      if (result?.status === 'success') {
        setStatus('saving');
        setMessage(`Saving ${result.totalDays} days of data...`);
        setPercent(50);
        setTotalDays(result.totalDays || 0);
        
        // Call another function to save the data
        const saveResult = await base44.functions.invoke('saveAppleHealthData', {
          data: result.data,
        });
        
        if (saveResult?.status === 'success') {
          setSaved(saveResult.saved || 0);
          setPercent(100);
          setMessage('Import complete!');
          setStatus('done');
        } else {
          throw new Error(saveResult?.error || 'Save failed');
        }
      } else {
        throw new Error(result?.error || 'Parse failed');
      }
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