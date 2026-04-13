import React, { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ImportContext = createContext();

export function useImport() {
  return useContext(ImportContext);
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
  };

  const startImport = async (file, mode) => {
    // This is called from AppleHealthImport
    // Just a placeholder—actual logic stays in ImportProgressPill via ImportContext
  };

  return (
    <ImportContext.Provider value={{ lastImportedAt, markImportDone, startImport }}>
      {children}
    </ImportContext.Provider>
  );
}