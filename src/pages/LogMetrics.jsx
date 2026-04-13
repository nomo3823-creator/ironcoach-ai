import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import moment from "moment";

export default function LogMetrics() {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: moment().format("YYYY-MM-DD"),
    hrv: "", resting_hr: "", sleep_hours: "", sleep_quality: "good",
    body_battery: "", spo2: "", readiness_score: "",
    ctl: "", atl: "", tsb: "", weight_kg: "", mood: "good",
    injury_flag: false, illness_flag: false, notes: "",
  });

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const data = Object.fromEntries(
      Object.entries(form).map(([k, v]) => {
        if (typeof v === "boolean") return [k, v];
        if (v === "") return [k, null];
        if (!isNaN(v) && v !== "") return [k, Number(v)];
        return [k, v];
      })
    );
    // Upsert: update existing entry for this date if it exists
    const existing = await base44.entities.DailyMetrics.filter({ date: form.date, created_by: currentUser.email });
    if (existing?.[0]) {
      await base44.entities.DailyMetrics.update(existing[0].id, data);
    } else {
      await base44.entities.DailyMetrics.create(data);
    }
    setSaving(false);
    toast.success("Metrics logged");
  }

  const f = (key, type = "number") => ({
    value: form[key] || "",
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
    type,
  });

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Log Daily Metrics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Record recovery and readiness data</p>
        </div>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm text-muted-foreground">
        <p><strong className="text-foreground">Pro tip:</strong> Connect Strava and Apple Health under <button onClick={() => window.location.href = "/integrations"} className="text-primary underline hover:no-underline">/integrations</button> to auto-populate these metrics.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <div>
          <Label>Date</Label>
          <Input type="date" {...f("date", "date")} />
        </div>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recovery Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>HRV (ms)</Label><Input {...f("hrv")} placeholder="65" /></div>
            <div><Label>Resting HR (bpm)</Label><Input {...f("resting_hr")} placeholder="48" /></div>
            <div><Label>Sleep Hours</Label><Input {...f("sleep_hours")} placeholder="7.5" step="0.5" /></div>
            <div>
              <Label>Sleep Quality</Label>
              <Select value={form.sleep_quality} onValueChange={(v) => setForm({ ...form, sleep_quality: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["poor","fair","good","excellent"].map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Body Battery</Label><Input {...f("body_battery")} placeholder="75" /></div>
            <div><Label>SpO2 (%)</Label><Input {...f("spo2")} placeholder="97" /></div>
            <div><Label>Readiness Score (0-100)</Label><Input {...f("readiness_score")} placeholder="72" /></div>
            <div><Label>Weight (kg)</Label><Input {...f("weight_kg")} placeholder="72.5" step="0.1" /></div>
          </div>
        </section>

        {/* Training Load is calculated from activities — hidden from manual entry */}

        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wellbeing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Mood</Label>
              <Select value={form.mood} onValueChange={(v) => setForm({ ...form, mood: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["great","good","okay","tired","exhausted"].map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-6">
            {[["injury_flag","Injury","flag anything hurting"],["illness_flag","Illness","feeling sick?"]].map(([k,l,s]) => (
              <div key={k} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 flex-1">
                <Switch checked={form[k]} onCheckedChange={() => setForm({ ...form, [k]: !form[k] })} />
                <div>
                  <p className="text-sm font-medium text-foreground">{l}</p>
                  <p className="text-xs text-muted-foreground">{s}</p>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything to note about today…" />
          </div>
        </section>

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Log Metrics</>}
        </Button>
      </form>
    </div>
  );
}