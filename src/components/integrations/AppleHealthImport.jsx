import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Parse Apple Health export XML and extract relevant records
function parseAppleHealthXML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const records = Array.from(doc.querySelectorAll("Record"));

  const metrics = {};

  for (const r of records) {
    const type = r.getAttribute("type") || "";
    const value = parseFloat(r.getAttribute("value"));
    const dateStr = (r.getAttribute("startDate") || "").substring(0, 10);
    if (!dateStr) continue;

    if (!metrics[dateStr]) metrics[dateStr] = { date: dateStr };

    if (type.includes("HeartRate") && !type.includes("Variability")) {
      // Resting HR — take minimum HR per day as a proxy for resting
      if (!metrics[dateStr].resting_hr || value < metrics[dateStr].resting_hr) {
        metrics[dateStr].resting_hr = Math.round(value);
      }
    }
    if (type.includes("HeartRateVariabilitySDNN")) {
      // HRV — take max per day
      if (!metrics[dateStr].hrv || value > metrics[dateStr].hrv) {
        metrics[dateStr].hrv = Math.round(value * 1000) / 10; // convert s → ms if needed
        // Apple exports HRV in seconds, convert to ms
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

export default function AppleHealthImport({ onImported }) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = parseAppleHealthXML(text);

      if (parsed.length === 0) {
        toast({ title: "No compatible data found", description: "Make sure you selected the export.xml file from Apple Health.", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Upsert into DailyMetrics
      let saved = 0;
      for (const day of parsed) {
        const existing = await base44.entities.DailyMetrics.filter({ date: day.date });
        if (existing.length > 0) {
          await base44.entities.DailyMetrics.update(existing[0].id, day);
        } else {
          await base44.entities.DailyMetrics.create(day);
        }
        saved++;
      }

      setResult({ saved });
      toast({ title: `Imported ${saved} days of health data from Apple Health` });
      onImported?.();
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    }

    setLoading(false);
    // reset input
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/40 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
        <span>
          Apple Health requires a native iOS app — no cloud API exists. To import your data:
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