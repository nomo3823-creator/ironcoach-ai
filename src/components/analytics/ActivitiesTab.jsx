import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2, Zap } from "lucide-react";
import moment from "moment";
import ReactMarkdown from "react-markdown";

const SPORT_ICONS = { swim: "🏊", bike: "🚴", run: "🏃", brick: "⚡", strength: "💪", other: "🏋️" };
const SPORT_COLORS = { swim: "text-swim", bike: "text-bike", run: "text-run", other: "text-muted-foreground" };

function secsToHMS(s) {
  if (!s) return "--";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function ActivityCard({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const [loadingNote, setLoadingNote] = useState(false);
  const [note, setNote] = useState(activity.ai_feedback || "");

  const tss = activity.training_stress_score || activity.tss || null;
  const highDecoupling = activity.aerobic_decoupling > 5;

  async function getNote() {
    if (note) { setExpanded(true); return; }
    setLoadingNote(true);
    setExpanded(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Coach comment (max 2 sentences, direct tone) on this ${activity.sport} workout:
${activity.title} · ${activity.date} · ${activity.distance_km ? activity.distance_km + "km" : ""} · ${activity.duration_minutes}min
Avg HR: ${activity.avg_hr || "n/a"}, Avg pace: ${activity.avg_pace || "n/a"}, Avg power: ${activity.avg_power || "n/a"}W
TSS: ${tss || "n/a"}, Decoupling: ${activity.aerobic_decoupling != null ? activity.aerobic_decoupling + "%" : "n/a"}
What was good, what to note for next time.`
    });
    setNote(res);
    await base44.entities.Activity.update(activity.id, { ai_feedback: res });
    setLoadingNote(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button className="w-full p-4 text-left flex items-center gap-3 hover:bg-secondary/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <span className="text-2xl shrink-0">{SPORT_ICONS[activity.sport] || "🏋️"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{activity.title}</span>
            {highDecoupling && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 shrink-0">High drift</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span>{moment(activity.date).format("MMM D, YYYY")}</span>
            {activity.distance_km && <span>{activity.distance_km}km</span>}
            <span>{activity.duration_minutes}min</span>
            {tss && <span>{Math.round(tss)} TSS</span>}
            {activity.suffer_score && <span>{Math.round(activity.suffer_score)} suffer</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {activity.avg_hr && <div><p className="text-muted-foreground">Avg HR</p><p className="font-semibold text-foreground">{activity.avg_hr} bpm</p></div>}
            {activity.max_hr && <div><p className="text-muted-foreground">Max HR</p><p className="font-semibold text-foreground">{activity.max_hr} bpm</p></div>}
            {activity.avg_pace && <div><p className="text-muted-foreground">Avg Pace</p><p className="font-semibold text-foreground">{activity.avg_pace} /km</p></div>}
            {activity.avg_power && <div><p className="text-muted-foreground">Avg Power</p><p className="font-semibold text-foreground">{activity.avg_power}W</p></div>}
            {activity.normalized_power && <div><p className="text-muted-foreground">NP</p><p className="font-semibold text-foreground">{activity.normalized_power}W</p></div>}
            {activity.intensity_factor && <div><p className="text-muted-foreground">IF</p><p className="font-semibold text-foreground">{activity.intensity_factor.toFixed(2)}</p></div>}
            {activity.elevation_gain && <div><p className="text-muted-foreground">Elevation</p><p className="font-semibold text-foreground">{activity.elevation_gain}m</p></div>}
            {activity.calories && <div><p className="text-muted-foreground">Calories</p><p className="font-semibold text-foreground">{activity.calories} kcal</p></div>}
            {activity.aerobic_decoupling != null && <div><p className="text-muted-foreground">Decoupling</p><p className={`font-semibold ${highDecoupling ? "text-orange-400" : "text-foreground"}`}>{activity.aerobic_decoupling.toFixed(1)}%</p></div>}
            {activity.avg_cadence && <div><p className="text-muted-foreground">Cadence</p><p className="font-semibold text-foreground">{activity.avg_cadence * 2} spm</p></div>}
            {activity.avg_temp_celsius != null && <div><p className="text-muted-foreground">Temp</p><p className="font-semibold text-foreground">{activity.avg_temp_celsius}°C</p></div>}
          </div>

          {note ? (
            <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 flex gap-2">
              <Zap className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">{note}</p>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={getNote} disabled={loadingNote}>
              {loadingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3 text-primary" />}
              Coach comment
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivitiesTab({ activities }) {
  const [sportFilter, setSportFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const sports = ["all", ...["swim", "bike", "run"].filter(s => activities.some(a => a.sport === s))];

  const seen = new Set();
  const filtered = activities
    .filter(a => sportFilter === "all" || a.sport === sportFilter)
    .filter(a => {
      const key = `${a.date}-${a.external_id || a.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.date > a.date ? 1 : -1);

  const paginated = filtered.slice(0, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Sport filter */}
      <div className="flex gap-2 flex-wrap">
        {sports.map(s => (
          <button
            key={s}
            onClick={() => { setSportFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sportFilter === s ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)} {s !== "all" && SPORT_ICONS[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          No activities found. Sync Strava to see your data here.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map(a => <ActivityCard key={a.id} activity={a} />)}
          </div>
          {paginated.length < filtered.length && (
            <Button variant="outline" className="w-full text-xs" onClick={() => setPage(p => p + 1)}>
              Load more ({filtered.length - paginated.length} remaining)
            </Button>
          )}
        </>
      )}
    </div>
  );
}