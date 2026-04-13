import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useImport } from "@/lib/ImportContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileDown, Plus } from "lucide-react";
import JSZip from "jszip";

const INSTRUCTIONS = [
  "Open the Health app on your iPhone",
  "Tap your profile picture (top right)",
  "Scroll down and tap 'Export All Health Data'",
  "Choose 'Export' and wait (may take a few minutes for large files)",
  "AirDrop or save the zip file to your computer",
  "Upload the export.zip or export.xml file below"
];

const IMPORT_MODES = [
  {
    id: 'smart',
    label: 'Smart import (recommended)',
    description: 'Last 90 days: full data. Last 2 years: HRV & weight only. Older: skipped.',
    estimatedTime: '2-4 minutes',
  },
  {
    id: '90days',
    label: 'Last 90 days only',
    description: 'Quick setup with recent metrics only.',
    estimatedTime: '1-2 minutes',
  },
  {
    id: '2years',
    label: 'Last 2 years',
    description: 'Full baseline data for trends & historical analysis.',
    estimatedTime: '3-6 minutes',
  },
  {
    id: 'alltime',
    label: 'All time (comprehensive)',
    description: 'Everything in your Apple Health export. Warning: very large files may take 10+ minutes.',
    estimatedTime: '5-15 minutes',
    warning: true,
  },
];



function ImportStep1({ onStart }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">How to Export Your Health Data</h3>
        <ol className="space-y-2">
          {INSTRUCTIONS.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="text-xs font-semibold text-primary bg-primary/20 rounded-full h-5 w-5 flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <Button onClick={onStart} className="gap-2 w-full">
        <FileDown className="h-4 w-4" /> I Have My Export File
      </Button>
    </div>
  );
}

function ImportStep2({ onFile, loading, selectedMode, onModeChange }) {
  const dropZoneRef = useRef();
  const fileRef = useRef();

  function handleFileDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Import range:</label>
        <div className="grid grid-cols-1 gap-2">
          {IMPORT_MODES.map(mode => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`p-3 rounded-lg border-2 transition-colors text-left ${
                selectedMode === mode.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{mode.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-accent">{mode.estimatedTime}</p>
                  {mode.warning && <p className="text-xs text-destructive mt-0.5">⚠ Large files</p>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={dropZoneRef}
        onDrop={handleFileDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium text-foreground">Drop your Apple Health file here</p>
        <p className="text-xs text-muted-foreground mt-1">or click to browse (.zip or .xml)</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.zip"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

function ImportStep3({ progress, counters, message }) {
  const totalRecords = Object.values(counters || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">Processing...</span>
          <span className="text-xs text-muted-foreground">{progress || 0}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${progress || 0}%` }}
          />
        </div>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground text-center">{message}</p>
      )}

      {counters && (
        <div className="grid grid-cols-2 gap-2 bg-secondary/30 rounded-lg p-3">
          {counters.hrv_records > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">HRV readings:</span> <span className="font-medium text-foreground">{counters.hrv_records}</span>
            </div>
          )}
          {counters.sleep_records > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Sleep nights:</span> <span className="font-medium text-foreground">{counters.sleep_records}</span>
            </div>
          )}
          {counters.resting_hr_records > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Resting HR days:</span> <span className="font-medium text-foreground">{counters.resting_hr_records}</span>
            </div>
          )}
          {counters.spo2_records > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">SpO2 readings:</span> <span className="font-medium text-foreground">{counters.spo2_records}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImportStep4({ result, onReset }) {
  if (!result) return null;

  const { saved, errors, counters, dateRange } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-recovery/10 border border-recovery/20 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-recovery shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Import Complete!</p>
          <p className="text-xs text-muted-foreground mt-1">
            {saved} days of health data saved to your profile. Your readiness scores are now calculating across {saved} dates.
          </p>
        </div>
      </div>

      {dateRange && (
        <div className="text-sm bg-secondary/30 rounded-lg p-3">
          <p className="text-muted-foreground text-xs mb-1">Data imported:</p>
          <p className="text-foreground font-medium">{dateRange}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        {counters?.hrv_records > 0 && (
          <div className="p-2 bg-secondary/30 rounded">
            <p className="text-muted-foreground">HRV days</p>
            <p className="font-semibold text-foreground">{counters.hrv_records}</p>
          </div>
        )}
        {counters?.sleep_records > 0 && (
          <div className="p-2 bg-secondary/30 rounded">
            <p className="text-muted-foreground">Sleep nights</p>
            <p className="font-semibold text-foreground">{counters.sleep_records}</p>
          </div>
        )}
        {counters?.weight_records > 0 && (
          <div className="p-2 bg-secondary/30 rounded">
            <p className="text-muted-foreground">Weight readings</p>
            <p className="font-semibold text-foreground">{counters.weight_records}</p>
          </div>
        )}
        {counters?.resting_hr_records > 0 && (
          <div className="p-2 bg-secondary/30 rounded">
            <p className="text-muted-foreground">Resting HR days</p>
            <p className="font-semibold text-foreground">{counters.resting_hr_records}</p>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs text-destructive">
            <p className="font-medium">{errors.length} records failed</p>
            <p className="text-destructive/80 mt-0.5">{errors.slice(0, 2).join('; ')}</p>
          </div>
        </div>
      )}

      <Button onClick={onReset} className="w-full gap-2">
        <Plus className="h-4 w-4" /> Import Another File
      </Button>
    </div>
  );
}

function pick(obj, keys) {
  const result = {};
  keys.forEach(key => {
    if (key in obj) result[key] = obj[key];
  });
  return result;
}

export default function AppleHealthImport({ onImported }) {
  const { currentUser } = useAuth();
  const importCtx = useImport();
  const fileRef = useRef();
  const [step, setStep] = useState(1);
  const [selectedMode, setSelectedMode] = useState('smart');

  const handleFile = async (file) => {
    if (!file || !currentUser) return;
    setStep(3);

    try {
      // Step 1: If zip file, extract the XML first
      let xmlFile = file;
      if (file.name.endsWith('.zip') || file.type === 'application/zip') {
        importCtx.updateProgress({ percent: 2, message: 'Extracting zip file...', counters: {} });
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const xmlEntry = Object.keys(contents.files).find(name => name.endsWith('export.xml') || name.endsWith('.xml'));
        if (!xmlEntry) throw new Error('No export.xml found in zip file');
        const xmlBlob = await contents.files[xmlEntry].async('blob');
        xmlFile = new File([xmlBlob], 'export.xml', { type: 'text/xml' });
      }

      // Step 2: Parse the XML file
      importCtx.updateProgress({ percent: 5, message: 'Starting parse...', counters: {} });
      const { parseAppleHealthXML } = await import('@/lib/appleHealthParser');

      const result = await parseAppleHealthXML(
        xmlFile,
        (progressData) => {
          importCtx.updateProgress({
            percent: Math.round(progressData.percent * 0.7), // parsing = 0-70%
            message: progressData.message,
            counters: progressData.counters,
          });
        },
        selectedMode
      );

      const { metrics, workouts, counters } = result;

      // Step 3: Save metrics to DailyMetrics (upsert per date)
      const today = new Date().toLocaleDateString('en-CA');
      const metricsToSave = metrics.filter(m => m.date <= today);
      const total = metricsToSave.length;
      let savedCount = 0;
      let errors = [];

      importCtx.updateProgress({
        percent: 70,
        message: `Saving ${total} days of metrics...`,
        counters,
      });

      // Process in batches of 20 to avoid overwhelming the API
      const BATCH_SIZE = 20;
      for (let i = 0; i < metricsToSave.length; i += BATCH_SIZE) {
        const batch = metricsToSave.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (metric) => {
          try {
            // Check if a record already exists for this date and user
            const existing = await base44.entities.DailyMetrics.filter({
              date: metric.date,
              created_by: currentUser.email,
            });

            const dataToSave = {
              ...metric,
              created_by: currentUser.email,
            };

            if (existing && existing.length > 0) {
              // Update existing record — only overwrite fields that Apple Health provides
              // Preserve any manually logged fields (mood, notes, injury_flag etc)
              const updateData = {};
              if (metric.hrv != null) updateData.hrv = metric.hrv;
              if (metric.resting_hr != null) updateData.resting_hr = metric.resting_hr;
              if (metric.sleep_hours != null) updateData.sleep_hours = metric.sleep_hours;
              if (metric.sleep_quality != null) updateData.sleep_quality = metric.sleep_quality;
              if (metric.sleep_deep_minutes != null) updateData.sleep_deep_minutes = metric.sleep_deep_minutes;
              if (metric.sleep_rem_minutes != null) updateData.sleep_rem_minutes = metric.sleep_rem_minutes;
              if (metric.sleep_awake_minutes != null) updateData.sleep_awake_minutes = metric.sleep_awake_minutes;
              if (metric.spo2 != null) updateData.spo2 = metric.spo2;
              if (metric.respiratory_rate != null) updateData.respiratory_rate = metric.respiratory_rate;
              if (metric.active_calories != null) updateData.active_calories = metric.active_calories;
              if (metric.vo2_max != null) updateData.vo2_max = metric.vo2_max;
              if (metric.weight_kg != null) updateData.weight_kg = metric.weight_kg;

              await base44.entities.DailyMetrics.update(existing[0].id, updateData);
            } else {
              // Create new record
              await base44.entities.DailyMetrics.create(dataToSave);
            }
            savedCount++;
          } catch (err) {
            errors.push(`${metric.date}: ${err.message}`);
          }
        }));

        const savePercent = 70 + Math.round(((i + BATCH_SIZE) / total) * 25);
        importCtx.updateProgress({
          percent: Math.min(95, savePercent),
          message: `Saving metrics... ${savedCount}/${total} days`,
          counters,
        });
      }

      // Step 4: Save Apple Watch workouts as Activity records (skip duplicates)
      if (workouts && workouts.length > 0) {
        importCtx.updateProgress({ percent: 96, message: `Saving ${workouts.length} workouts...`, counters });

        for (const workout of workouts) {
          try {
            // Check for duplicate by external_id
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
            // Skip duplicate/error workouts silently
          }
        }
      }

      // Step 5: Update AthleteProfile with import metadata
      importCtx.updateProgress({ percent: 98, message: 'Finalising...', counters });

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
        // Non-fatal — metrics already saved
      }

      // Step 6: Mark complete
      importCtx.updateProgress({
        percent: 100,
        message: 'Import complete!',
        counters,
        saved: savedCount,
        errors,
        totalDays: savedCount,
      });

      importCtx.markImportDone();
      setStep(4);
      toast.success(`Imported ${savedCount} days of Apple Health data`);
      onImported?.();

    } catch (err) {
      toast.error(`Import failed: ${err.message}`);
      setStep(2); // Go back to file picker
      importCtx.cancelImport();
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // If import is active (not idle or done), disable file input and show progress
  const isImporting = importCtx && ['parsing', 'saving'].includes(importCtx.status);
  const isFinished = importCtx && importCtx.status === 'done';

  // Map import context state to local component view
  let displayStep = step;
  if (isImporting) {
    displayStep = 3;
  } else if (isFinished) {
    displayStep = 4;
  }

  function reset() {
    setStep(1);
    setSelectedMode('smart');
    importCtx.cancelImport();
  }

  return (
    <div className="space-y-4">
      {displayStep === 1 && <ImportStep1 onStart={() => setStep(2)} />}
      {displayStep === 2 && (
        <ImportStep2
          onFile={handleFile}
          loading={isImporting}
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
        />
      )}
      {displayStep === 3 && (
        <ImportStep3
          progress={importCtx?.percent || 0}
          counters={importCtx?.counters || {}}
          message={importCtx?.message || ''}
        />
      )}
      {displayStep === 4 && (
        <ImportStep4
          result={{
            saved: importCtx?.saved || 0,
            errors: importCtx?.errors || [],
            counters: importCtx?.counters || {},
            dateRange: `Imported ${importCtx?.totalDays || 0} days`,
          }}
          onReset={reset}
        />
      )}
    </div>
  );
}