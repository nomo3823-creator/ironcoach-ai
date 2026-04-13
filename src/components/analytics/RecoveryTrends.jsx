import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import moment from "moment";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 40% 9%)",
  border: "1px solid hsl(222 20% 16%)",
  borderRadius: "8px",
  color: "hsl(210 40% 96%)",
  fontSize: 12,
};

export default function RecoveryTrends({ metrics = [] }) {
  const data = metrics
    .filter((m) => m.hrv || m.sleep_hours)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: moment(m.date).format("MMM D"),
      HRV: m.hrv || 0,
      Readiness: m.readiness_score || 0,
      Sleep: m.sleep_hours || 0,
      "Body Battery": m.body_battery || 0,
    }));

  if (!data.length) return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">No recovery data yet. Log daily metrics to see trends.</p>
    </div>
  );

  const chartProps = { data, children: null };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {[
        { title: "HRV & Readiness", lines: [["HRV", "#14b8a6"], ["Readiness", "#0ea5e9"]] },
        { title: "Sleep & Body Battery", lines: [["Sleep", "#a855f7"], ["Body Battery", "#f59e0b"]] },
      ].map(({ title, lines }) => (
        <div key={title} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <div className="flex gap-3 text-xs">
              {lines.map(([k, c]) => (
                <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="h-2 w-4 rounded-full inline-block" style={{ backgroundColor: c }} /> {k}
                </span>
              ))}
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 14%)" />
                <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215 20% 50%)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                {lines.map(([k, c]) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={c} strokeWidth={2} dot={{ r: 2, fill: c }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}