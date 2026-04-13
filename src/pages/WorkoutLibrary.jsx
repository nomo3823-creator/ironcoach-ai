import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Search, Dumbbell, Trash2, Sparkles } from "lucide-react";
import { sportColors, sportIcons, formatDuration } from "@/lib/sportUtils";
import { getRaceType, getRaceLabel } from "@/lib/raceTypes";
import { cn } from "@/lib/utils";

const INTENSITIES = { easy: "Easy", moderate: "Moderate", hard: "Hard", race_pace: "Race Pace", recovery: "Recovery" };
const CATS = ["endurance","tempo","intervals","threshold","recovery","race_simulation","technique"];

export default function WorkoutLibrary() {
  const { currentUser } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("all");
  const [cat, setCat] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ title:"", sport:"run", category:"endurance", duration_minutes:60, intensity:"moderate", description:"", structure:"", tss_estimate:0 });

  async function load() {
    const data = await base44.entities.WorkoutTemplate.filter({ created_by: currentUser.email }, "-created_date", 500);
    setTemplates(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    templates.filter((t) =>
      (sport === "all" || t.sport === sport) &&
      (cat === "all" || t.category === cat) &&
      (!search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()))
    ), [templates, sport, cat, search]
  );

  async function create(e) {
    e.preventDefault();
    await base44.entities.WorkoutTemplate.create({ ...form, duration_minutes: Number(form.duration_minutes), tss_estimate: Number(form.tss_estimate) });
    setForm({ title:"", sport:"run", category:"endurance", duration_minutes:60, intensity:"moderate", description:"", structure:"", tss_estimate:0 });
    setShowForm(false);
    load();
  }

  async function generateStarters() {
    setGenerating(true);
    const profile = (await base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1))?.[0];
    const raceType = profile?.race_type || "custom";
    const raceInfo = getRaceType(raceType);
    const sportsList = raceInfo.sports.join(", ");
    const perSport = Math.max(3, Math.ceil(12 / raceInfo.sports.length));
    const total = perSport * raceInfo.sports.length;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate ${total} varied workout templates for a ${getRaceLabel(raceType)} athlete covering these sports only: ${sportsList}. Produce roughly ${perSport} per sport. Include beginner to advanced. Include structure details.`,
      response_json_schema: {
        type: "object",
        properties: {
          workouts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" }, sport: { type: "string" }, category: { type: "string" },
                duration_minutes: { type: "number" }, intensity: { type: "string" },
                description: { type: "string" }, structure: { type: "string" },
                target_zones: { type: "string" }, tss_estimate: { type: "number" },
              },
            },
          },
        },
      },
    });
    if (result?.workouts) await base44.entities.WorkoutTemplate.bulkCreate(result.workouts);
    setGenerating(false);
    load();
  }

  async function del(id) {
    await base44.entities.WorkoutTemplate.delete(id);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Workout Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{templates.length} workouts available</p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" onClick={generateStarters} disabled={generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Generate Starters
            </Button>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1.5" /> Add Workout</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({...form,title:e.target.value})} required /></div>
            <div>
              <Label>Sport</Label>
              <Select value={form.sport} onValueChange={(v) => setForm({...form,sport:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["swim","bike","run","brick","strength"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({...form,category:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({...form,duration_minutes:e.target.value})} /></div>
            <div>
              <Label>Intensity</Label>
              <Select value={form.intensity} onValueChange={(v) => setForm({...form,intensity:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(INTENSITIES).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>TSS Estimate</Label><Input type="number" value={form.tss_estimate} onChange={(e) => setForm({...form,tss_estimate:e.target.value})} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} rows={2} /></div>
          <div><Label>Workout Structure</Label><Textarea value={form.structure} onChange={(e) => setForm({...form,structure:e.target.value})} rows={3} placeholder="e.g. 10min WU → 5×(4min Z4 / 2min Z1) → 10min CD" /></div>
          <div className="flex gap-2">
            <Button type="submit">Save Workout</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workouts…" className="pl-9" />
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sports</SelectItem>
            {["swim","bike","run","brick","strength"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CATS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c.replace("_"," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{templates.length === 0 ? "No workouts yet. Use Generate Starters or add your own." : "No workouts match your filters."}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const c = sportColors[t.sport] || sportColors.other;
            return (
              <div key={t.id} className="rounded-xl border bg-card overflow-hidden group" style={{ borderColor: c.hex + "40" }}>
                <div className="h-0.5" style={{ background: c.hex }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{sportIcons[t.sport] || "⚡"}</span>
                      <h3 className="font-semibold text-foreground text-sm leading-tight">{t.title}</h3>
                    </div>
                    <button onClick={() => del(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary font-medium" style={{ color: c.hex }}>{t.sport}</span>
                    {t.category && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{t.category.replace("_"," ")}</span>}
                    <span className="text-xs text-muted-foreground">{formatDuration(t.duration_minutes)}</span>
                    {t.tss_estimate > 0 && <span className="text-xs text-muted-foreground">{t.tss_estimate} TSS</span>}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description}</p>}
                  {t.structure && (
                    <pre className="mt-2 p-2 rounded-md bg-secondary/40 text-[11px] text-secondary-foreground font-mono line-clamp-3 whitespace-pre-wrap">
                      {t.structure}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}