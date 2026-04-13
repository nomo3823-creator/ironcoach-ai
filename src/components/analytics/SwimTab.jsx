import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";
import moment from "moment";
import DailyRecommendationWidget from "./DailyRecommendationWidget";

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

export default function SwimTab({ activities, metrics, profile }) {
  const swims = activities.filter(a => a.sport === "swim" && a.date).sort((a, b) => a.date > b.date ? 1 : -1);

  // Pace per 100m trend
  const paceTrend = swims.filter(r => r.avg_pace_per_100m || (r.avg_pace && r.distance_km)).map(r => {
    const p100 = r.avg_pace_per_100m || (r.distance_km > 0 ? (r.duration_minutes * 60 / (r.distance_km * 10)) : null);
    return p100 ? {
      date: moment(r.date).format("MMM D"),
      pace: Math.round(p100),
    } : null;
  }).filter(Boolean);

  const css = profile?.css_per_100m;

  // Weekly swim volume (meters)
  const weeklyVol = [];
  for (let w = 11; w >= 0; w--) {
    const start = moment().subtract(w * 7 + 7, "days");
    const end = moment().subtract(w * 7, "days");
    const wSwims = swims.filter(a => moment(a.date).isBetween(start, end));
    weeklyVol.push({
      label: start.format("MMM D"),
      meters: Math.round(wSwims.reduce((s, a) => s + (a.distance_km || 0) * 1000, 0)),
      sessions: wSwims.length,
    });
  }

  // Distance per session
  const distTrend = swims.filter(r => r.distance_km).slice(-20).map(r => ({
    date: moment(r.date).format("MMM D"),
    km: r.distance_km,
    meters: Math.round(r.distance_km * 1000),
  }));

  function fmtPace(secs) {
    if (!secs) return "--";
    return `${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, "0")} /100m`;
  }

  if (swims.length === 0) {
    return (
      <div className="space-y-4">
        <DailyRecommendationWidget sport="swim" activities={activities} metrics={metrics} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No swim data synced yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DailyRecommendationWidget sport="swim" activities={activities} metrics={metrics} />

      {/* Pace trend */}
      {paceTrend.length > 2 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Pace per 100m Trend</h3>
          <p className="text-xs text-muted-foreground">
            Lower = faster.{css ? ` Your CSS: ${fmtPace(css)}` : ""}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`} reversed />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [fmtPace(v), "Pace"]} />
              {css && <Line y={css} dataKey={() => css} stroke="#22c55e" strokeDasharray="3 3" dot={false} name="CSS" />}
              <Line type="monotone" dataKey="pace" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 2 }} name="Pace" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly volume */}
        {weeklyVol.some(w => w.meters > 0) && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Weekly Swim Volume</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyVol}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${v}m`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}m`, "Volume"]} />
                <Bar dataKey="meters" fill="hsl(199 89% 48%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distance per session */}
        {distTrend.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Distance per Session</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={distTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${v}m`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}m`, "Distance"]} />
                <Bar dataKey="meters" fill="hsl(199 89% 48%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* CSS comparison */}
      {paceTrend.length > 0 && css && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3">CSS vs Actual Pace</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold font-mono text-primary">{fmtPace(css)}</p>
              <p className="text-xs text-muted-foreground mt-1">Critical Swim Speed (threshold)</p>
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-foreground">{fmtPace(paceTrend[paceTrend.length - 1]?.pace)}</p>
              <p className="text-xs text-muted-foreground mt-1">Last session pace</p>
            </div>
          </div>
          {paceTrend.length > 0 && css && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {paceTrend[paceTrend.length - 1]?.pace < css
                ? "Last session was faster than your CSS — great effort!"
                : `Last session was ${Math.round(paceTrend[paceTrend.length - 1]?.pace - css)}s/100m off CSS pace.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}