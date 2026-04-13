import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Cell, Legend } from "recharts";
import moment from "moment";
import { calculateFitnessMetrics, getActivityTSS } from "@/lib/planUtils";

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

function TSSHeatmap({ activities }) {
  // 16-week heatmap
  const weeks = [];
  for (let w = 15; w >= 0; w--) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = moment().subtract(w * 7 + (6 - d), "days");
      const dateStr = date.format("YYYY-MM-DD");
      const dayActs = activities.filter(a => a.date === dateStr);
      const tss = dayActs.reduce((s, a) => s + (a.training_stress_score || a.tss || 0), 0);
      days.push({ date: dateStr, tss, label: date.format("MMM D") });
    }
    weeks.push(days);
  }

  function tssColor(tss) {
    if (tss === 0) return "hsl(222 20% 16%)";
    if (tss < 40) return "hsl(199 89% 20%)";
    if (tss < 80) return "hsl(199 89% 35%)";
    if (tss < 120) return "hsl(199 89% 48%)";
    return "hsl(38 92% 50%)";
  }

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5">
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((d, i) => (
            <div key={i} className="h-4 w-3 text-[9px] text-muted-foreground flex items-center">{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                title={`${day.label}: ${Math.round(day.tss)} TSS`}
                className="h-4 w-4 rounded-sm cursor-default transition-opacity hover:opacity-80"
                style={{ backgroundColor: tssColor(day.tss) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 40, 80, 120].map((v, i) => (
          <div key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: tssColor(v + 1) }} />
        ))}
        <span>More TSS</span>
      </div>
    </div>
  );
}

function GaugeBar({ label, value, min, max, danger, good, unit }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const isGood = value >= good[0] && value <= good[1];
  const isDanger = value > danger;
  const color = isDanger ? "#ef4444" : isGood ? "#22c55e" : "#eab308";
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span style={{ color }} className="font-mono font-semibold">{value?.toFixed ? value.toFixed(2) : value} {unit}</span>
      </div>
      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[10px] text-muted-foreground">Ideal: {good[0]}–{good[1]} {unit}</p>
    </div>
  );
}

export default function LoadTab({ metrics, activities }) {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const sorted = [...metrics].sort((a, b) => a.date > b.date ? 1 : -1).filter(m => m.date <= todayStr);
  
  // Calculate fitness from activities (not stored metrics)
  const fitnessCalc = calculateFitnessMetrics(activities);
  const fitnessData = Object.entries(fitnessCalc.history || {})
    .filter(([date]) => date <= todayStr)
    .slice(-90)
    .map(([date, vals]) => ({
      date: moment(date).format("MMM D"),
      CTL: vals.ctl,
      ATL: vals.atl,
      TSB: vals.tsb,
    }));

  // TSS by sport per week (16 weeks)
  const sportTSSData = [];
  for (let w = 15; w >= 0; w--) {
    const start = moment().subtract(w * 7 + 7, "days");
    const end = moment().subtract(w * 7, "days");
    const weekActs = activities.filter(a => moment(a.date).isBetween(start, end));
    sportTSSData.push({
      label: start.format("MMM D"),
      swim: Math.round(weekActs.filter(a => a.sport === "swim").reduce((s, a) => s + getActivityTSS(a), 0)),
      bike: Math.round(weekActs.filter(a => a.sport === "bike").reduce((s, a) => s + getActivityTSS(a), 0)),
      run: Math.round(weekActs.filter(a => a.sport === "run").reduce((s, a) => s + getActivityTSS(a), 0)),
    });
  }

  // A:C Ratio from calculated fitness
  const acRatio = fitnessCalc.ctl > 0 ? parseFloat((fitnessCalc.atl / fitnessCalc.ctl).toFixed(2)) : null;

  // Monotony = avg daily TSS / std dev last 7 days
  const last7 = activities.filter(a => moment(a.date).isAfter(moment().subtract(7, "days")));
  const dailyTSS = [];
  for (let i = 0; i < 7; i++) {
    const d = moment().subtract(i, "days").format("YYYY-MM-DD");
    dailyTSS.push(last7.filter(a => a.date === d).reduce((s, a) => s + getActivityTSS(a), 0));
  }
  const avg = dailyTSS.reduce((s, v) => s + v, 0) / 7;
  const std = Math.sqrt(dailyTSS.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / 7);
  const monotony = std > 0 ? parseFloat((avg / std).toFixed(2)) : null;
  
  // Calculate today's TSS and weekly total for labels
  const thisWeekStart = moment().startOf('week').format('YYYY-MM-DD');
  const thisWeekTSS = Object.entries(fitnessCalc.dailyTSS || {})
    .filter(([d]) => d >= thisWeekStart && d <= todayStr)
    .reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-5">
      {fitnessData.length > 3 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">CTL / ATL / TSB — 90 Days</h3>
            <p className="text-xs text-muted-foreground">Blue = fitness (CTL, 42-day avg). Red = fatigue (ATL, 7-day avg). Teal = form (TSB = CTL minus ATL). The gap between CTL and ATL shows training stress accumulation.</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={fitnessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="hsl(222 20% 30%)" />
              <Line type="monotone" dataKey="CTL" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={false} name="CTL (Fitness)" />
              <Line type="monotone" dataKey="ATL" stroke="hsl(12 76% 61%)" strokeWidth={2} dot={false} name="ATL (Fatigue)" />
              <Line type="monotone" dataKey="TSB" stroke="hsl(173 58% 39%)" strokeWidth={2} dot={false} name="TSB (Form)" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* TSS Heatmap */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground">Training Load Calendar (16 weeks)</h3>
          <p className="text-xs text-muted-foreground">Each cell = one day. Color intensity = training stress. Light = easy, bright = hard, dark = rest. Consistent moderate load with rest days is optimal.</p>
        </div>
        <TSSHeatmap activities={activities} />
        <p className="text-xs text-muted-foreground mt-2">Today: {Math.round(fitnessCalc.dailyTSS[todayStr] || 0)} TSS | This week: {Math.round(thisWeekTSS)} TSS</p>
      </div>

      {/* Sport TSS breakdown */}
      {sportTSSData.some(w => w.swim + w.bike + w.run > 0) && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">Weekly TSS by Sport</h3>
            <p className="text-xs text-muted-foreground">Grouped bars show how your training stress is distributed across sports each week.</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sportTSSData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="swim" fill="hsl(199 89% 48%)" name="Swim" />
              <Bar dataKey="bike" fill="hsl(38 92% 50%)" name="Bike" />
              <Bar dataKey="run" fill="hsl(12 76% 61%)" name="Run" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gauges */}
      {(acRatio || monotony) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {acRatio !== null && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Acute:Chronic Ratio</h3>
              <GaugeBar label="A:C Ratio" value={acRatio} min={0.5} max={1.8} danger={1.5} good={[0.8, 1.3]} unit="" />
              <p className="text-xs text-muted-foreground">Compares your 7-day load to 42-day baseline. Research shows ratios above 1.5 increase injury risk significantly (Gabbett 2016).</p>
            </div>
          )}
          {monotony !== null && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Training Monotony</h3>
              <GaugeBar label="Monotony Score" value={monotony} min={0} max={3} danger={1.8} good={[0.5, 1.5]} unit="" />
              <p className="text-xs text-muted-foreground">Measures daily training variation. High monotony (same load every day) increases overtraining risk. Keep below 1.5.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}