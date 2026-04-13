import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const ZONES = [
  { name: "Z1 Recovery", color: "#14b8a6", actual: 18, target: 20 },
  { name: "Z2 Endurance", color: "#0ea5e9", actual: 44, target: 60 },
  { name: "Z3 Tempo",    color: "#f59e0b", actual: 22, target: 10 },
  { name: "Z4 Threshold",color: "#ef4444", actual: 12, target: 8  },
  { name: "Z5 VO2 Max",  color: "#dc2626", actual:  4, target: 2  },
];

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 40% 9%)",
  border: "1px solid hsl(222 20% 16%)",
  borderRadius: "8px",
  color: "hsl(210 40% 96%)",
  fontSize: 12,
};

function Donut({ data, title }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" strokeWidth={2} stroke="hsl(222 40% 9%)">
              {data.map((d, i) => <Cell key={i} fill={ZONES[i]?.color || "#6b7280"} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-1.5 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: ZONES[i]?.color }} />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
            <span className="text-foreground font-medium">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ZoneDistribution() {
  const actual = ZONES.map((z) => ({ name: z.name, value: z.actual }));
  const target = ZONES.map((z) => ({ name: z.name, value: z.target }));

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-5">
        <Donut data={actual} title="Current Distribution" />
        <Donut data={target} title="Recommended (80/20 Polarized)" />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Zone Comparison</h3>
        <div className="space-y-3">
          {ZONES.map((z) => (
            <div key={z.name}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{z.name}</span>
                <span className="text-foreground font-medium">{z.actual}% <span className="text-muted-foreground">/ {z.target}% target</span></span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${z.actual}%`, backgroundColor: z.color }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">💡 Polarized training: ~80% easy aerobic (Z1-Z2) + ~20% high intensity (Z3-Z5) for optimal Ironman adaptation.</p>
      </div>
    </div>
  );
}