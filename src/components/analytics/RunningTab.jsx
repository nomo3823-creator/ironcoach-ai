import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ScatterChart, Scatter, ReferenceLine, BarChart, Bar, Cell } from "recharts";
import { PieChart, Pie, Legend } from "recharts";
import moment from "moment";
import DailyRecommendationWidget from "./DailyRecommendationWidget";

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

function paceToSecs(p) {
  if (!p) return null;
  const [m, s] = String(p).split(":").map(Number);
  return m * 60 + (s || 0);
}

function secsToMinKm(s) {
  if (!s) return "--";
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export default function RunningTab({ activities, metrics, profile }) {
  const seen = new Set();
  const runs = activities
    .filter(a => a.sport === "run" && a.date)
    .filter(r => {
      const key = `${r.date}-${r.external_id || r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date > b.date ? 1 : -1);

  // Pace trend
  const paceTrend = runs.slice(-30).map(r => {
    const ps = paceToSecs(r.avg_pace);
    return {
      date: moment(r.date).format("MMM D"),
      pace: ps ? parseFloat((ps / 60).toFixed(2)) : null,
      hr: r.avg_hr || null,
      intensity: r.intensity_level || "easy",
    };
  }).filter(d => d.pace);

  // HR vs Pace scatter
  const hrPaceScatter = runs.filter(r => r.avg_hr && r.avg_pace).map(r => ({
    hr: r.avg_hr,
    pace: paceToSecs(r.avg_pace),
    date: r.date,
    name: moment(r.date).format("MMM D"),
  }));

  // Aerobic decoupling
  const decouplingData = runs.filter(r => r.aerobic_decoupling !== undefined && r.aerobic_decoupling !== null)
    .slice(-20).map(r => ({
      date: moment(r.date).format("MMM D"),
      decoupling: parseFloat(r.aerobic_decoupling.toFixed(1)),
      high: r.aerobic_decoupling > 5,
    }));

  // Cadence trend
  const cadenceTrend = runs.filter(r => r.avg_cadence).slice(-30).map(r => ({
    date: moment(r.date).format("MMM D"),
    cadence: r.avg_cadence * 2, // strava gives one-leg cadence
  }));

  // Zone distribution (last 30 days)
  const last30Runs = runs.filter(r => moment(r.date).isAfter(moment().subtract(30, "days")));
  const zones = [
    last30Runs.reduce((s, r) => s + (r.hr_zone_1_min || 0), 0),
    last30Runs.reduce((s, r) => s + (r.hr_zone_2_min || 0), 0),
    last30Runs.reduce((s, r) => s + (r.hr_zone_3_min || 0), 0),
    last30Runs.reduce((s, r) => s + (r.hr_zone_4_min || 0), 0),
    last30Runs.reduce((s, r) => s + (r.hr_zone_5_min || 0), 0),
  ];
  const totalZoneMins = zones.reduce((s, v) => s + v, 0);
  const zonePieData = zones.map((v, i) => ({ name: `Z${i + 1}`, value: v, pct: totalZoneMins > 0 ? Math.round(v / totalZoneMins * 100) : 0 }))
    .filter(z => z.value > 0);
  const zoneColors = ["hsl(199 89% 48%)", "hsl(173 58% 39%)", "hsl(38 92% 50%)", "hsl(12 76% 61%)", "hsl(0 72% 51%)"];

  // Best efforts (parse from best_efforts JSON field)
  const distances = ["400m", "1km", "1mi", "5km", "10km", "half_marathon", "marathon"];
  const bestEffortMap = {};
  runs.forEach(r => {
    if (!r.best_efforts) return;
    try {
      const efforts = JSON.parse(r.best_efforts);
      efforts.forEach(e => {
        const key = e.name || e.distance;
        if (!bestEffortMap[key] || e.elapsed_time < bestEffortMap[key].time) {
          bestEffortMap[key] = { time: e.elapsed_time, date: r.date };
        }
      });
    } catch {}
  });

  if (runs.length === 0) {
    return (
      <div className="space-y-4">
        <DailyRecommendationWidget sport="run" activities={activities} metrics={metrics} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No run data synced yet. Connect Strava and sync your activities.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DailyRecommendationWidget sport="run" activities={activities} metrics={metrics} />

      {/* Pace trend */}
      {paceTrend.length > 2 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Pace Trend — Last 30 Runs</h3>
          <p className="text-xs text-muted-foreground">Lower = faster. Watch for gradual improvement over weeks.</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")}`} reversed />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")} /km`, "Pace"]} />
              <Line type="monotone" dataKey="pace" stroke="hsl(12 76% 61%)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* HR vs Pace scatter */}
      {hrPaceScatter.length > 3 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">HR vs Pace — Aerobic Fitness Trend</h3>
          <p className="text-xs text-muted-foreground">As you get fitter, dots should shift toward lower HR at the same pace (right side of chart).</p>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="pace" name="Pace (secs/km)" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={secsToMinKm} label={{ value: "Pace", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <YAxis dataKey="hr" name="Avg HR" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [n === "Pace (secs/km)" ? secsToMinKm(v) + " /km" : v, n]} />
              <Scatter data={hrPaceScatter} fill="hsl(12 76% 61%)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Aerobic decoupling */}
        {decouplingData.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Aerobic Decoupling per Run</h3>
            <p className="text-xs text-muted-foreground">Above 5% = cardiac drift. Red bars = pacing went aerobic.</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={decouplingData}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}%`, "Decoupling"]} />
                <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="3 3" />
                <Bar dataKey="decoupling" radius={[3, 3, 0, 0]}>
                  {decouplingData.map((d, i) => <Cell key={i} fill={d.high ? "#ef4444" : "hsl(12 76% 61%)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Cadence trend */}
        {cadenceTrend.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Running Cadence</h3>
            <p className="text-xs text-muted-foreground">Green band = 170–180 spm optimal zone.</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={cadenceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <YAxis domain={[150, 200]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} spm`, "Cadence"]} />
                <ReferenceLine y={170} stroke="#22c55e" strokeDasharray="3 3" />
                <ReferenceLine y={180} stroke="#22c55e" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="cadence" stroke="hsl(12 76% 61%)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Zone distribution */}
        {zonePieData.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">HR Zone Distribution (last 30 days)</h3>
            <p className="text-xs text-muted-foreground">Aim for ≥80% in Zones 1-2 (80/20 training).</p>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={zonePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} label={({ name, pct }) => `${name}: ${pct}%`} labelLine={false} fontSize={10}>
                  {zonePieData.map((_, i) => <Cell key={i} fill={zoneColors[i % zoneColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} min`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Best efforts */}
        {Object.keys(bestEffortMap).length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Best Efforts</h3>
            <div className="space-y-2">
              {Object.entries(bestEffortMap).slice(0, 6).map(([dist, val]) => (
                <div key={dist} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{dist}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">
                      {Math.floor(val.time / 60)}:{String(val.time % 60).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground">{moment(val.date).format("MMM D, 'YY")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}