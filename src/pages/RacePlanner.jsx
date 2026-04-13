import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trophy, MapPin, Calendar, Target, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

const DEFAULT_CHECKLIST = [
  "Race kit laid out and tested","Bike serviced & tuned","Nutrition plan finalized",
  "Transition bags packed","Race number & timing chip ready","Wetsuit tested",
  "Hydration system filled","Travel & accommodation confirmed","Pre-race meal planned",
  "GPS watch & power meter charged","Spare tubes & CO2","Sunscreen & race day essentials",
];

export default function RacePlanner() {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [predicting, setPredicting] = useState(null);
  const [form, setForm] = useState({ name: "", date: "", distance: "140.6", priority: "A", location: "", elevation_m: "" });

  async function load() {
    const data = await base44.entities.Race.list("date", 50);
    setRaces(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault();
    await base44.entities.Race.create({
      ...form,
      elevation_m: form.elevation_m ? Number(form.elevation_m) : 0,
      checklist: DEFAULT_CHECKLIST.map((item) => ({ item, checked: false })),
    });
    setForm({ name: "", date: "", distance: "140.6", priority: "A", location: "", elevation_m: "" });
    setShowForm(false);
    load();
  }

  async function toggleCheck(race, idx) {
    const cl = [...(race.checklist || [])];
    cl[idx] = { ...cl[idx], checked: !cl[idx].checked };
    await base44.entities.Race.update(race.id, { checklist: cl });
    load();
  }

  async function deleteRace(id) {
    await base44.entities.Race.delete(id);
    load();
  }

  async function predict(race) {
    setPredicting(race.id);
    const profile = (await base44.entities.AthleteProfile.list("-created_date", 1))?.[0];
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `IronCoach AI: Predict realistic Ironman ${race.distance} split times.
FTP: ${profile?.current_ftp || 250}W | CSS/100m: ${profile?.css_per_100m || 95}s | Run threshold: ${profile?.threshold_run_pace || "5:00"}/km
Race: ${race.name} | Elevation: ${race.elevation_m || 0}m | Location: ${race.location || "unknown"}
Return times as h:mm:ss strings and readiness_score 0-100.`,
      response_json_schema: {
        type: "object",
        properties: {
          swim_time: { type: "string" },
          t1_time: { type: "string" },
          bike_time: { type: "string" },
          t2_time: { type: "string" },
          run_time: { type: "string" },
          total_time: { type: "string" },
          readiness_score: { type: "number" },
        },
      },
    });
    await base44.entities.Race.update(race.id, {
      predicted_swim_time: result.swim_time,
      predicted_t1_time: result.t1_time,
      predicted_bike_time: result.bike_time,
      predicted_t2_time: result.t2_time,
      predicted_run_time: result.run_time,
      predicted_total_time: result.total_time,
      readiness_score: result.readiness_score,
    });
    setPredicting(null);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Race Planner</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage races and predict finish times</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-2" /> Add Race</Button>
      </div>

      {showForm && (
        <form onSubmit={create} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><Label>Race Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Race Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div>
              <Label>Distance</Label>
              <Select value={form.distance} onValueChange={(v) => setForm({ ...form, distance: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="70.3">70.3 Half Ironman</SelectItem>
                  <SelectItem value="140.6">140.6 Full Ironman</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A Race (Primary)</SelectItem>
                  <SelectItem value="B">B Race (Secondary)</SelectItem>
                  <SelectItem value="C">C Race (Training)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Elevation (m)</Label><Input type="number" value={form.elevation_m} onChange={(e) => setForm({ ...form, elevation_m: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Create Race</Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {races.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No races yet. Add your target race to generate a plan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {races.map((race) => {
            const days = moment(race.date).diff(moment(), "days");
            const past = days < 0;
            const open = expanded === race.id;
            const pct = (race.checklist || []).filter((c) => c.checked).length;
            const total = (race.checklist || []).length;

            return (
              <div key={race.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-5 flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0",
                    race.priority === "A" ? "bg-accent/15 text-accent" :
                    race.priority === "B" ? "bg-primary/15 text-primary" :
                    "bg-secondary text-muted-foreground"
                  )}>{race.priority}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{race.name}</h3>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{moment(race.date).format("MMM D, YYYY")}</span>
                      {race.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{race.location}</span>}
                      <span>{race.distance === "140.6" ? "Full Ironman" : "Half Ironman 70.3"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!past && <div className="text-right"><span className="text-2xl font-bold text-accent">{days}</span><span className="text-xs text-muted-foreground ml-1">days</span></div>}
                    {past && <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">Past</span>}
                    <button onClick={() => setExpanded(open ? null : race.id)} className="p-1.5 text-muted-foreground hover:text-foreground">
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-border p-5 space-y-5">
                    {/* Predicted splits */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Predicted Splits</h4>
                        <Button size="sm" variant="outline" disabled={!!predicting} onClick={() => predict(race)}>
                          {predicting === race.id ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Predicting…</> : <><Target className="h-3.5 w-3.5 mr-1.5" />Predict</>}
                        </Button>
                      </div>
                      {race.predicted_total_time ? (
                        <>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-4 rounded-lg bg-secondary/30">
                            {[["🏊","Swim",race.predicted_swim_time],["🔄","T1",race.predicted_t1_time],["🚴","Bike",race.predicted_bike_time],["🔄","T2",race.predicted_t2_time],["🏃","Run",race.predicted_run_time],["🏁","Total",race.predicted_total_time]].map(([e,l,v]) => (
                              <div key={l} className="text-center">
                                <div className="text-xl">{e}</div>
                                <div className="text-sm font-semibold text-foreground mt-1">{v || "—"}</div>
                                <div className="text-[10px] text-muted-foreground">{l}</div>
                              </div>
                            ))}
                          </div>
                          {race.readiness_score > 0 && (
                            <div className="mt-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Race Readiness</span>
                                <span className="font-medium text-foreground">{race.readiness_score}%</span>
                              </div>
                              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${race.readiness_score}%` }} />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">No prediction yet. Click Predict to generate finish time estimate.</p>
                      )}
                    </div>

                    {/* Checklist */}
                    {(race.checklist || []).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-Race Checklist</h4>
                          <span className="text-xs text-muted-foreground">{pct}/{total}</span>
                        </div>
                        <div className="h-1.5 bg-secondary rounded-full mb-3 overflow-hidden">
                          <div className="h-full bg-recovery rounded-full transition-all" style={{ width: total ? `${(pct/total)*100}%` : "0%" }} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-1.5">
                          {race.checklist.map((c, i) => (
                            <label key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/30 cursor-pointer transition-colors">
                              <Checkbox checked={c.checked} onCheckedChange={() => toggleCheck(race, i)} />
                              <span className={cn("text-sm", c.checked ? "line-through text-muted-foreground" : "text-foreground")}>{c.item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRace(race.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Race
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}