import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, BarChart, Bar, Legend } from "recharts";
import ReactMarkdown from "react-markdown";
import moment from "moment";
import { calculateFitnessMetrics, getActivityTSS } from "@/lib/planUtils";

function MetricCard({ label, value, unit, change, description, color }) {
  const trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = color === "tsb"
    ? (change > 0 ? "#22c55e" : change < 0 ? "#ef4444" : "#6b7280")
    : (change > 0 ? "#22c55e" : change < 0 ? "#ef4444" : "#6b7280");

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold font-mono text-foreground">{value ?? "--"}</span>
        {unit && <span className="text-xs text-muted-foreground mb-1">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1" style={{ color: trendColor }}>
          <TrendIcon className="h-3 w-3" />
          <span className="text-xs font-medium">{Math.abs(change)} {change > 0 ? "up" : "down"} this week</span>
        </div>
      )}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

export default function OverviewTab({ metrics, activities, profile }) {
  const [aiSummary, setAiSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const todayStr = new Date().toLocaleDateString('en-CA');
  const sorted = [...metrics].sort((a, b) => a.date > b.date ? 1 : -1).filter(m => m.date <= todayStr);
  const latest = sorted[sorted.length - 1];
  const weekAgo = sorted[sorted.length - 8];

  // Calculate fitness metrics from activities (not stored DailyMetrics)
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

  // 12-week volume chart
  const weeklyVols = [];
  for (let w = 11; w >= 0; w--) {
    const start = moment().subtract(w * 7 + 7, "days");
    const end = moment().subtract(w * 7, "days");
    const weekActs = activities.filter(a => moment(a.date).isBetween(start, end));
    const label = start.format("MMM D");
    weeklyVols.push({
      label,
      swim: parseFloat((weekActs.filter(a => a.sport === "swim").reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60).toFixed(1)),
      bike: parseFloat((weekActs.filter(a => a.sport === "bike").reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60).toFixed(1)),
      run: parseFloat((weekActs.filter(a => a.sport === "run").reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60).toFixed(1)),
    });
  }

  const weeklyTSS = activities.filter(a => moment(a.date).isAfter(moment().subtract(7, "days")))
    .reduce((s, a) => s + getActivityTSS(a), 0);

  async function loadAISummary() {
    setLoadingAI(true);
    try {
      const last14acts = activities.slice(0, 20);
      const summary = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an endurance coach. Summarize this athlete's last 14 days in 3 plain-English sentences:
CTL: ${fitnessCalc.ctl.toFixed(1)}, ATL: ${fitnessCalc.atl.toFixed(1)}, TSB: ${fitnessCalc.tsb.toFixed(1)}
Weekly TSS: ${weeklyTSS}, Activities: ${last14acts.length}
Sports: swim ${last14acts.filter(a=>a.sport==="swim").length}, bike ${last14acts.filter(a=>a.sport==="bike").length}, run ${last14acts.filter(a=>a.sport==="run").length}
Profile limiter: ${profile?.biggest_limiter ?? "unknown"}
Cover: current fitness state, fatigue level, what to focus on this week. Be direct and specific.`,
      });
      setAiSummary(summary);
    } catch (err) {
      setAiSummary('');
    }
    setLoadingAI(false);
  }

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Fitness (CTL)" value={Math.round(fitnessCalc.ctl)}
          description="Your aerobic fitness base. Built over 42 days. Target: 60-80 for age-group, 80-120 competitive."
          change={weekAgo ? Math.round(fitnessCalc.ctl - (Object.values(fitnessCalc.history || {})[Math.max(0, Object.keys(fitnessCalc.history || {}).length - 8)]?.ctl || 0)) : undefined} />
        <MetricCard label="Fatigue (ATL)" value={Math.round(fitnessCalc.atl)}
          description="Short-term fatigue from recent training. 7-day window. When ATL > CTL you're accumulating more stress than fitness."
          change={weekAgo ? Math.round(fitnessCalc.atl - (Object.values(fitnessCalc.history || {})[Math.max(0, Object.keys(fitnessCalc.history || {}).length - 8)]?.atl || 0)) : undefined} />
        <MetricCard label="Form (TSB)" value={Math.round(fitnessCalc.tsb)}
          description="Form = CTL minus ATL. Optimal race performance: -10 to +5. Hard training: -20 to -10."
          change={weekAgo ? Math.round(fitnessCalc.tsb - (Object.values(fitnessCalc.history || {})[Math.max(0, Object.keys(fitnessCalc.history || {}).length - 8)]?.tsb || 0)) : undefined} color="tsb" />
        <MetricCard label="Weekly TSS" value={Math.round(weeklyTSS)} unit="pts"
          description="Total training stress this week. Typical: 300-500 for 8-12hr/week athletes." />
        <MetricCard label="Readiness" value={latest?.readiness_score ?? null} unit="/100"
          description="Composite score from HRV, sleep, body battery, TSB, load." />
      </div>

      {/* CTL/ATL/TSB chart */}
      {fitnessData.length > 3 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">Fitness · Fatigue · Form (90 days)</h3>
            <p className="text-xs text-muted-foreground">Blue = fitness (CTL, 42-day avg). Red = fatigue (ATL, 7-day avg). Teal = form (TSB = CTL minus ATL).</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fitnessData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="hsl(222 20% 22%)" strokeDasharray="4 4" />
              <ReferenceLine y={-10} stroke="hsl(38 92% 50%)" strokeDasharray="2 2" strokeOpacity={0.4} label={{ value: "optimal zone", fontSize: 9, fill: "hsl(38 92% 50%)" }} />
              <Line type="monotone" dataKey="CTL" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={false} name="CTL (Fitness)" />
              <Line type="monotone" dataKey="ATL" stroke="hsl(12 76% 61%)" strokeWidth={2} dot={false} name="ATL (Fatigue)" />
              <Line type="monotone" dataKey="TSB" stroke="hsl(173 58% 39%)" strokeWidth={2} dot={false} name="TSB (Form)" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weekly volume chart */}
      {weeklyVols.some(w => w.swim + w.bike + w.run > 0) && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground">Weekly Volume — 12 weeks (hours)</h3>
            <p className="text-xs text-muted-foreground">Stacked view of your weekly training hours by sport. Consistency with variety is the goal.</p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyVols}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}h`, ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="swim" stackId="a" fill="hsl(199 89% 48%)" name="Swim" />
              <Bar dataKey="bike" stackId="a" fill="hsl(38 92% 50%)" name="Bike" />
              <Bar dataKey="run" stackId="a" fill="hsl(12 76% 61%)" name="Run" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI Weekly Summary */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">AI Weekly Summary</h3>
          </div>
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={loadAISummary} disabled={loadingAI}>
            {loadingAI ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</> : "Generate"}
          </Button>
        </div>
        {aiSummary ? (
          <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none [&_p]:text-muted-foreground">
            {aiSummary}
          </ReactMarkdown>
        ) : (
          <p className="text-xs text-muted-foreground">Click Generate to get a personalized coaching summary of your last 14 days.</p>
        )}
      </div>
    </div>
  );
}