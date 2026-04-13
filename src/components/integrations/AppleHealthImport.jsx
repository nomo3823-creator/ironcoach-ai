import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function parseAppleHealthXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid XML file. Please ensure you uploaded the correct export.xml from Apple Health.');
  }
  
  const records = Array.from(doc.querySelectorAll("Record"));
  if (records.length === 0) {
    throw new Error('No health records found in XML file.');
  }

  const metrics = {};

  for (const r of records) {
    const type = r.getAttribute("type") || "";
    const value = parseFloat(r.getAttribute("value"));
    const dateStr = (r.getAttribute("startDate") || "").substring(0, 10);
    if (!dateStr) continue;

    if (!metrics[dateStr]) metrics[dateStr] = { date: dateStr };

    if (type.includes("HeartRate") && !type.includes("Variability")) {
      if (!metrics[dateStr].resting_hr || value < metrics[dateStr].resting_hr) {
        metrics[dateStr].resting_hr = Math.round(value);
      }
    }
    if (type.includes("HeartRateVariabilitySDNN")) {
      if (!metrics[dateStr].hrv || value > metrics[dateStr].hrv) {
        metrics[dateStr].hrv = Math.round(value * 1000) / 10;
        if (metrics[dateStr].hrv < 1) metrics[dateStr].hrv = Math.round(metrics[dateStr].hrv * 1000);
      }
    }
    if (type.includes("SleepAnalysis")) {
      const start = new Date(r.getAttribute("startDate"));
      const end = new Date(r.getAttribute("endDate"));
      const hours = (end - start) / (1000 * 60 * 60);
      if (r.getAttribute("value") === "HKCategoryValueSleepAnalysisAsleep") {
        metrics[dateStr].sleep_hours = Math.round(((metrics[dateStr].sleep_hours || 0) + hours) * 10) / 10;
      }
    }
    if (type.includes("OxygenSaturation")) {
      metrics[dateStr].spo2 = Math.round(value * 100);
    }
    if (type.includes("BodyMass")) {
      metrics[dateStr].weight_kg = Math.round(value * 10) / 10;
    }
  }

  return Object.values(metrics).filter(m =>
    m.hrv || m.resting_hr || m.sleep_hours || m.spo2 || m.weight_kg
  );
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

export default function AppleHealthImport({ onImported }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult(null);

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const text = reader.result;
        console.log('File read, size:', text.length);

        let parsed;
        try {
          parsed = parseAppleHealthXML(text);
        } catch (parseErr) {
          console.error('XML parse error:', parseErr);
          toast({
            title: "Invalid XML file",
            description: parseErr.message,
            variant: "destructive"
          });
          setLoading(false);
          if (fileRef.current) fileRef.current.value = "";
          return;
        }

        console.log('Metrics extracted:', parsed.length);

        if (parsed.length === 0) {
          toast({
            title: "No compatible data found",
            description: "Make sure you selected the export.xml file from Apple Health.",
            variant: "destructive"
          });
          setLoading(false);
          if (fileRef.current) fileRef.current.value = "";
          return;
        }

        const { saved, errors } = await saveMetricsBatch(parsed);

        setResult({ saved, errors });

        if (errors.length > 0) {
          toast({
            title: `Imported ${saved} days, ${errors.length} failed`,
            description: errors.slice(0, 3).join("; "),
            variant: "destructive"
          });
        } else {
          toast({
            title: `✓ Imported ${saved} days of health data from Apple Health`
          });
        }

        onImported?.();
        setLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err) {
        console.error('Import error:', err);
        toast({
          title: "Import failed",
          description: err?.message || "Unknown error",
          variant: "destructive"
        });
        setLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };

    reader.onerror = () => {
      console.error('File read error:', reader.error);
      toast({
        title: "File read failed",
        description: "Could not read the file. Try again.",
        variant: "destructive"
      });
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    };

    reader.readAsText(file);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/40 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
        <span>
          To import your Apple Health data:
          <ol className="list-decimal ml-4 mt-1 space-y-0.5">
            <li>Open the <strong className="text-foreground">Health</strong> app on your iPhone</li>
            <li>Tap your profile photo → <strong className="text-foreground">Export All Health Data</strong></li>
            <li>Share the ZIP to yourself, extract it, then upload <strong className="text-foreground">export.xml</strong> below</li>
          </ol>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {loading ? "Importing…" : "Upload export.xml"}
        </Button>

        {result && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-recovery" />
            {result.saved} days imported
          </span>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}