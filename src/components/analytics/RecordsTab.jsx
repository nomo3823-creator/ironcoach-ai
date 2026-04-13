import { Trophy, TrendingUp, TrendingDown, Minus, Star } from "lucide-react";
import moment from "moment";

function secsToHMS(s) {
  if (!s) return "--";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function PRCard({ label, value, date, unit, isRecent, description }) {
  const recencyDays = date ? moment().diff(moment(date), "days") : null;
  const fresh = recencyDays !== null && recencyDays <= 30;
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${fresh || isRecent ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        {(fresh || isRecent) && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 px-1.5 py-0.5 rounded-full bg-amber-400/10">
            <Star className="h-2.5 w-2.5" /> PR
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono text-foreground">{value} <span className="text-sm text-muted-foreground font-normal">{unit}</span></p>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      {date && <p className="text-[10px] text-muted-foreground">{moment(date).format("MMM D, YYYY")} · {recencyDays === 0 ? "today" : recencyDays === 1 ? "yesterday" : `${recencyDays}d ago`}</p>}
    </div>
  );
}

export default function RecordsTab({ activities, metrics }) {
  const runs = activities.filter(a => a.sport === "run");
  const rides = activities.filter(a => a.sport === "bike");
  const sorted30 = [...activities].filter(a => moment(a.date).isAfter(moment().subtract(30, "days")));

  // Run PRs from best_efforts
  const bestEffortMap = {};
  const distOrder = ["400m", "1km", "1 mile", "5km", "10km", "Half-Marathon", "Marathon"];
  runs.forEach(r => {
    if (!r.best_efforts) return;
    try {
      JSON.parse(r.best_efforts).forEach(e => {
        const key = e.name;
        if (!bestEffortMap[key] || e.elapsed_time < bestEffortMap[key].time) {
          bestEffortMap[key] = { time: e.elapsed_time, date: r.date };
        }
      });
    } catch {}
  });

  // Longest run/ride
  const longestRun = runs.reduce((best, r) => (!best || (r.distance_km || 0) > best.distance_km) ? r : best, null);
  const longestRide = rides.reduce((best, r) => (!best || (r.distance_km || 0) > best.distance_km) ? r : best, null);

  // FTP — max from activities' avg_power or NP
  const maxFTPApprox = rides.filter(r => r.normalized_power || r.avg_power).reduce((best, r) => {
    const p = r.normalized_power || r.avg_power;
    if (!best || p > best.power) return { power: p, date: r.date };
    return best;
  }, null);

  // Best 20-min power (approximation)
  const best20min = rides.filter(r => r.normalized_power && r.duration_minutes >= 20).reduce((best, r) => {
    if (!best || r.normalized_power > best.power) return { power: r.normalized_power, date: r.date };
    return best;
  }, null);

  // Biggest week ever
  const weeklyTSS = {};
  activities.forEach(a => {
    const week = moment(a.date).startOf("isoWeek").format("YYYY-MM-DD");
    if (!weeklyTSS[week]) weeklyTSS[week] = { tss: 0, vol: 0, date: week };
    weeklyTSS[week].tss += (a.training_stress_score || a.tss || 0);
    weeklyTSS[week].vol += (a.duration_minutes || 0) / 60;
  });
  const biggestWeek = Object.values(weeklyTSS).reduce((best, w) => (!best || w.vol > best.vol) ? w : best, null);

  // Peak CTL
  const sortedMetrics = [...metrics].sort((a, b) => a.date > b.date ? 1 : -1);
  const peakCTL = sortedMetrics.reduce((best, m) => (!best || (m.ctl || 0) > best.ctl) ? { ctl: m.ctl, date: m.date } : best, null);

  return (
    <div className="space-y-6">
      {/* Run PRs */}
      {Object.keys(bestEffortMap).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Running Personal Bests</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {distOrder.filter(d => bestEffortMap[d]).map(dist => (
              <PRCard
                key={dist}
                label={dist}
                value={secsToHMS(bestEffortMap[dist].time)}
                date={bestEffortMap[dist].date}
                isRecent={moment().diff(moment(bestEffortMap[dist].date), "days") <= 30}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cycling PRs */}
      {(maxFTPApprox || best20min) && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Cycling Power Records</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {maxFTPApprox && <PRCard label="Peak NP (approx FTP)" value={maxFTPApprox.power} unit="W" date={maxFTPApprox.date} />}
            {best20min && <PRCard label="Best 20-min NP" value={best20min.power} unit="W" date={best20min.date} />}
          </div>
        </div>
      )}

      {/* Volume PRs */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-400" /> Volume Records</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {longestRun?.distance_km && <PRCard label="Longest Run" value={longestRun.distance_km.toFixed(1)} unit="km" date={longestRun.date} description={`${longestRun.duration_minutes}min`} />}
          {longestRide?.distance_km && <PRCard label="Longest Ride" value={longestRide.distance_km.toFixed(1)} unit="km" date={longestRide.date} description={`${longestRide.duration_minutes}min`} />}
          {biggestWeek?.vol > 0 && <PRCard label="Biggest Week" value={biggestWeek.vol.toFixed(1)} unit="h" date={biggestWeek.date} description={`${Math.round(biggestWeek.tss)} TSS`} />}
          {peakCTL?.ctl && <PRCard label="Peak Fitness (CTL)" value={Math.round(peakCTL.ctl)} unit="pts" date={peakCTL.date} description="Highest fitness level reached" />}
        </div>
      </div>

      {activities.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Sync your activities from Strava to see your personal records here.
        </div>
      )}
    </div>
  );
}