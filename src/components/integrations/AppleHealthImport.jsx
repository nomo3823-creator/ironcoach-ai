import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileDown, Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import JSZip from "jszip";
import { parseAppleHealthXML } from "@/lib/appleHealthParser";

const INSTRUCTIONS = [
  "Open the Health app on your iPhone",
  "Tap your profile picture (top right)",
  "Scroll down and tap 'Export All Health Data'",
  "Choose 'Export' and wait (may take a few minutes for large files)",
  "AirDrop or save the zip file to your computer",
  "Upload the export.zip or export.xml file below"
];

async function extractXMLFromZip(zipFile) {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(zipFile);
    const xmlFile = contents.file('export.xml');
    if (!xmlFile) {
      throw new Error('export.xml not found in zip file. Make sure you exported from Health app.');
    }
    const blob = await xmlFile.async('blob');
    return blob;
  } catch (err) {
    throw new Error('Failed to extract zip: ' + err.message);
  }
}

async function saveMetricsBatch(metrics) {
  let saved = 0;
  const errors = [];

  for (const day of metrics) {
    try {
      const existing = await base44.entities.DailyMetrics.filter({ date: day.date });
      if (existing.length > 0) {
        await base44.entities.DailyMetrics.update(existing[0].id, day);
      } else {
        await base44.entities.DailyMetrics.create(day);
      }
      saved++;
    } catch (err) {
      errors.push(`${day.date}: ${err.message}`);
    }
  }

  return { saved, errors };
}

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
      <Button onClick={onStart} className="gap-2 w-full sm:w-auto">
        <FileDown className="h-4 w-4" /> I Have My Export File
      </Button>
    </div>
  );
}

function ImportStep2({ onFile, loading }) {
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

  const fileSizeMB = (size) => (size / 1024 / 1024).toFixed(1);
  const estimateTime = (size) => {
    const mb = size / 1024 / 1024;
    if (mb < 100) return '1-2 minutes';
    if (mb < 500) return '2-5 minutes';
    return '5-10 minutes';
  };

  return (
    <div className="space-y-3">
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
      <div className="text-xs text-muted-foreground space-y-1">
        <p>✓ Accepts: export.zip or export.xml from Apple Health</p>
        <p>✓ File size is automatically compressed during import</p>
      </div>
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
  const totalFound = Object.values(counters || {}).reduce((a, b) => a + b, 0);

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

export default function AppleHealthImport({ onImported }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [counters, setCounters] = useState(null);
  const [result, setResult] = useState(null);

  async function handleFile(file) {
    setLoading(true);
    setProgress(0);
    setCounters(null);
    setStep(3);

    try {
      let xmlFile = file;
      setMessage('Preparing file...');

      // Handle zip files
      if (file.name.endsWith('.zip')) {
        setMessage('Extracting export.xml from zip...');
        xmlFile = await extractXMLFromZip(file);
      }

      const sizeMB = (xmlFile.size / 1024 / 1024).toFixed(1);
      if (sizeMB > 2048) {
        throw new Error('File exceeds 2GB. Please export the last 2 years only.');
      }

      if (sizeMB > 100) {
        setMessage(`Large file detected (${sizeMB}MB) — this may take several minutes. Keep this tab open.`);
      }

      // Parse file
      const parseResult = await parseAppleHealthXML(xmlFile, ({ percent, message: msg, counters: cnt }) => {
        setProgress(percent);
        setMessage(msg);
        setCounters(cnt);
      });

      setMessage('Saving to database...');
      const { saved, errors } = await saveMetricsBatch(parseResult.metrics);

      // Calculate date range
      const dates = parseResult.metrics.map(m => m.date).sort();
      const dateRange = dates.length > 0 
        ? `${dates[0]} to ${dates[dates.length - 1]} (${dates.length} days)`
        : 'No data';

      setResult({ saved, errors, counters: parseResult.counters, dateRange });
      setStep(4);

      if (errors.length === 0) {
        toast({
          title: `✓ Imported ${saved} days of Apple Health data`,
          description: `Your readiness and recovery metrics are now populated.`,
        });
      } else {
        toast({
          title: `Imported ${saved} days, ${errors.length} failed`,
          description: 'Most data was saved successfully.',
          variant: 'default',
        });
      }

      onImported?.();
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Import failed',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1);
    setProgress(0);
    setMessage('');
    setCounters(null);
    setResult(null);
  }

  return (
    <div className="space-y-4">
      {step === 1 && <ImportStep1 onStart={() => setStep(2)} />}
      {step === 2 && <ImportStep2 onFile={handleFile} loading={loading} />}
      {step === 3 && <ImportStep3 progress={progress} counters={counters} message={message} />}
      {step === 4 && <ImportStep4 result={result} onReset={reset} />}
    </div>
  );
}