import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
    setStatus('done');
  };

  const startImport = async (file, mode) => {
    // This is called from AppleHealthImport
    // Just a placeholder—actual logic stays in ImportProgressPill via ImportContext
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