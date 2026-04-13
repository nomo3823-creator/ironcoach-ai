import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { sportColors, sportIcons, formatDuration, phaseLabels } from "@/lib/sportUtils";
import { ChevronLeft, ChevronRight, Loader2, X, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import moment from "moment";
import GeneratePlanModal from "../components/plan/GeneratePlanModal";
import PlanChangeLogPanel from "../components/plan/PlanChangeLogPanel";

const STATUS_STYLES = {
  completed: "bg-recovery/10 text-recovery",
  skipped: "bg-destructive/10 text-destructive",
  modified: "bg-accent/10 text-accent",
  planned: "bg-secondary text-secondary-foreground",
};

const INTENSITY_LABELS = { easy: "Easy", moderate: "Moderate", hard: "Hard", race_pace: "Race Pace", recovery: "Recovery" };

export default function TrainingPlan() {
  const { currentUser } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(moment().startOf("month"));
  const [selectedDay, setSelectedDay] = useState(null);
  const [showGenerate, setShowGenerate] = useState(false);

  async function load() {
    setLoading(true);
    const data = await base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }, "date", 1000);
    setWorkouts(data || []);
    setLoading(false);
  }

  useEffect(() => { if (!currentUser) return; load(); }, [currentUser]);

  const days = useMemo(() => {
    const start = month.clone().startOf("month").startOf("isoWeek");
    const end = month.clone().endOf("month").endOf("isoWeek");
    const arr = [];
    const d = start.clone();
    while (d.isSameOrBefore(end)) { arr.push(d.clone()); d.add(1, "day"); }
    return arr;
  }, [month]);

  const byDate = useMemo(() => {
    const map = {};
    workouts.forEach((w) => { if (!map[w.date]) map[w.date] = []; map[w.date].push(w); });
    return map;
  }, [workouts]);

  const selectedWorkouts = selectedDay ? byDate[selectedDay.format("YYYY-MM-DD")] || [] : [];

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Training Plan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Periodized training calendar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGenerate(true)}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Generate Plan
          </Button>
          <Button size="icon" variant="outline" onClick={() => setMonth((m) => m.clone().subtract(1, "month"))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground w-36 text-center">{month.format("MMMM YYYY")}</span>
          <Button size="icon" variant="outline" onClick={() => setMonth((m) => m.clone().add(1, "month"))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList className="bg-secondary mb-5">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="changes">Change Log</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = day.format("YYYY-MM-DD");
                const inMonth = day.month() === month.month();
                const isToday = key === moment().format("YYYY-MM-DD");
                const dayWorkouts = byDate[key] || [];
                const isSel = selectedDay?.isSame(day, "day");
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      "min-h-[80px] lg:min-h-[96px] p-1.5 border-b border-r border-border text-left transition-colors",
                      !inMonth && "opacity-25",
                      isSel && "bg-primary/5",
                      isToday && !isSel && "bg-secondary/50"
                    )}
                  >
                    <span className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {day.date()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayWorkouts.slice(0, 3).map((w) => {
                        const c = sportColors[w.sport] || sportColors.other;
                        return (
                          <div key={w.id} className="flex items-center gap-1 text-[10px] truncate">
                            <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                            <span className={cn("truncate text-foreground/80", w.status === "completed" && "line-through text-muted-foreground", w.status === "modified" && "text-accent/80")}>
                              {w.title}
                            </span>
                          </div>
                        );
                      })}
                      {dayWorkouts.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayWorkouts.length - 3}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="mt-5 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">{selectedDay.format("dddd, MMMM D")}</h2>
                <Button size="icon" variant="ghost" onClick={() => setSelectedDay(null)}><X className="h-4 w-4" /></Button>
              </div>
              {selectedWorkouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No workouts planned.</p>
              ) : (
                <div className="space-y-3">
                  {selectedWorkouts.map((w) => {
                    const c = sportColors[w.sport] || sportColors.other;
                    return (
                      <div key={w.id} className="rounded-lg border bg-secondary/20 p-4" style={{ borderColor: c.hex + "40" }}>
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="text-xl">{sportIcons[w.sport] || "⚡"}</span>
                          <h3 className="font-semibold text-foreground">{w.title}</h3>
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_STYLES[w.status] || STATUS_STYLES.planned)}>
                            {w.status}
                          </span>
                          {w.phase && <span className="text-xs text-muted-foreground">{phaseLabels[w.phase]}</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{formatDuration(w.duration_minutes)}</span>
                          {w.intensity && <span>{INTENSITY_LABELS[w.intensity]}</span>}
                          {w.target_hr_zone && <span>HR: {w.target_hr_zone}</span>}
                          {w.target_pace && <span>Pace: {w.target_pace}</span>}
                          {w.target_power > 0 && <span>{w.target_power}W</span>}
                          {w.tss_estimate > 0 && <span>{w.tss_estimate} TSS</span>}
                        </div>
                        {w.description && <p className="text-sm text-muted-foreground mt-2">{w.description}</p>}
                        {w.structure && (
                          <pre className="mt-2 p-3 rounded-md bg-background text-xs font-mono whitespace-pre-wrap text-secondary-foreground">
                            {w.structure}
                          </pre>
                        )}
                        {w.ai_adjustment_reason && (
                          <div className="mt-2 flex items-start gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/10 text-xs text-primary">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{w.ai_adjustment_reason}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="changes">
          <PlanChangeLogPanel />
        </TabsContent>
      </Tabs>

      {showGenerate && <GeneratePlanModal onClose={() => { setShowGenerate(false); load(); }} />}
    </div>
  );
}