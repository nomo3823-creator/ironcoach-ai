import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function TrainingLoadChart({ activities }) {
  const last28days = Array.from({ length: 28 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    return d.toISOString().split("T")[0];
  });

  const data = last28days.map(date => {
    const dayActivities = activities.filter(a => a.date === date);
    const tss = dayActivities.reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0);
    return { date, tss };
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold text-foreground">28-Day Load</h3>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data}>
          <Line type="monotone" dataKey="tss" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}