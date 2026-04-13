import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ReferenceLine, ScatterChart, Scatter } from "recharts";
import moment from "moment";

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

const SLEEP_QUALITY_COLOR = { poor: "#ef4444", fair: "#f97316", good: "#22c55e", excellent: "#84cc16" };

export default function RecoveryTab({ metrics }) {
  const sorted = [...metrics].sort((a, b) => a.date > b.date ? 1 : -1);
  const todayStr = new Date().toISOString().split("T")[0];
  const last90 = sorted.filter(m => m.date <= todayStr).slice(-90);

  // HRV with 14-day rolling avg
  const hrvData = last90.filter(m => m.hrv).map((m, i, arr) => {
    const window = arr.slice(Math.max(0, i - 13), i + 1).filter(d => d.hrv);
    const avg = window.reduce((s, d) => s + d.hrv, 0) / window.length;
    return {
      date: moment(m.date).format("MMM D"),
      hrv: m.hrv,
      avg14: parseFloat(avg.toFixed(1)),
    };
  });

  // Resting HR
  const rhrData = last90.filter(m => m.resting_hr).map(m => ({
    date: moment(m.date).format("MMM D"),
    rhr: m.resting_hr,
  }));

  // Sleep
  const sleepData = last90.filter(m => m.sleep_hours && m.sleep_hours > 0 && m.sleep_hours < 24).map(m => ({
    date: moment(m.date).format("MMM D"),
    fullDate: m.date,
    hours: parseFloat(m.sleep_hours.toFixed(1)),
    quality: m.sleep_quality || "good",
    color: SLEEP_QUALITY_COLOR[m.sleep_quality] || "#3b82f6",
  }));

  // Body Battery
  const bbData = last90.filter(m => m.body_battery).map(m => ({
    date: moment(m.date).format("MMM D"),
    bb: m.body_battery,
  }));

  // Readiness history
  const readinessData = last90.filter(m => m.readiness_score).map(m => ({
    date: moment(m.date).format("MMM D"),
    score: m.readiness_score,
  }));

  // Recovery vs Load scatter (TSB vs next-day readiness)
  const rcScatter = sorted.slice(-60).filter((m, i, arr) => {
    return m.tsb && arr[i + 1]?.readiness_score;
  }).map((m, i, arr) => ({
    tsb: m.tsb,
    readiness: arr[i + 1].readiness_score,
  }));

  return (
    <div className="space-y-5">
      {/* HRV */}
      {hrvData.length > 3 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">HRV Trend (90 days)</h3>
          <p className="text-xs text-muted-foreground">Blue line = daily HRV. Dashed = 14-day rolling average. Staying above average = good recovery.</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hrvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}ms`, ""]} />
              <Line type="monotone" dataKey="hrv" stroke="hsl(199 89% 48%)" strokeWidth={1.5} dot={{ r: 2 }} name="HRV" />
              <Line type="monotone" dataKey="avg14" stroke="#eab308" strokeWidth={2} strokeDasharray="4 4" dot={false} name="14-day avg" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Resting HR */}
        {rhrData.length > 3 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Resting Heart Rate</h3>
            <p className="text-xs text-muted-foreground">Lower is better. Spike = fatigue/illness signal.</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={rhrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} bpm`, "RHR"]} />
                <Line type="monotone" dataKey="rhr" stroke="hsl(12 76% 61%)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sleep */}
        {sleepData.length > 3 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Sleep Hours</h3>
            <p className="text-xs text-muted-foreground">Colors = quality. Aim for 7.5h+ consistently.</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={sleepData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.1)" }} content={({ active, payload }) => active && payload?.[0] ? <div style={tooltipStyle}><p>{payload[0].payload.date}</p><p className="font-semibold">{payload[0].value}h ({payload[0].payload.quality})</p></div> : null} />
                <ReferenceLine y={7.5} stroke="#22c55e" strokeDasharray="3 3" />
                <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                  {sleepData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Body Battery */}
        {bbData.length > 3 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Body Battery</h3>
            <p className="text-xs text-muted-foreground">Garmin metric. Below 40 consistently = underrecovery.</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={bbData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}`, "Body Battery"]} />
                <ReferenceLine y={40} stroke="#f97316" strokeDasharray="3 3" />
                <Bar dataKey="bb" fill="hsl(173 58% 39%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Readiness history */}
        {readinessData.length > 3 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Readiness Score History</h3>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={readinessData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}/100`, "Readiness"]} />
                <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" />
                <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="score" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* TSB vs Readiness scatter */}
      {rcScatter.length > 5 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">TSB vs Next-Day Readiness</h3>
          <p className="text-xs text-muted-foreground">Shows how your body's form score correlates with next-day recovery. Dots clustering top-right = good relationship.</p>
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="tsb" name="TSB" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} label={{ value: "TSB (Form)", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <YAxis dataKey="readiness" name="Readiness" domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
              <Scatter data={rcScatter} fill="hsl(199 89% 48%)" fillOpacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}