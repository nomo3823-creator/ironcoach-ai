import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import moment from "moment";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 40% 9%)",
  border: "1px solid hsl(222 20% 16%)",
  borderRadius: "8px",
  color: "hsl(210 40% 96%)",
  fontSize: 12,
};

export default function FitnessChart({ metrics = [] }) {
  const data = metrics
    .filter((m) => m.ctl || m.atl || m.tsb)
    .map((m) => ({ date: moment(m.date).format("MMM D"), CTL: m.ctl || 0, ATL: m.atl || 0, TSB: m.tsb || 0 }));

  if (!data.length) return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">No fitness data yet. Log daily metrics to see your CTL/ATL/TSB trends.</p>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Fitness / Fatigue / Form</h3>
        <div className="flex gap-4 text-xs">
          {[["CTL", "#0ea5e9"], ["ATL", "#ef4444"], ["TSB", "#14b8a6"]].map(([k, c]) => (
            <span key={k} className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-5 rounded-full inline-block" style={{ backgroundColor: c }} /> {k}
            </span>
          ))}
        </div>
      </div>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              {[["ctl","#0ea5e9"],["atl","#ef4444"]].map(([id, c]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={c} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 14%)" />
            <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="CTL" stroke="#0ea5e9" fill="url(#ctl)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="ATL" stroke="#ef4444" fill="url(#atl)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="TSB" stroke="#14b8a6" fill="none" strokeWidth={2} strokeDasharray="5 4" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}