import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function ReadinessGauge({ readiness }) {
  if (!readiness) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 h-64 animate-pulse">
        <div className="h-full bg-secondary/20 rounded" />
      </div>
    );
  }

  // Show empty state when no data available
  if (!readiness.hasData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        <div className="text-3xl mb-2">📊</div>
        <h3 className="text-sm font-semibold text-foreground">No readiness data yet</h3>
        <p className="text-xs text-muted-foreground">
          Import Apple Health data or complete your morning check-in to see your readiness score.
        </p>
        <Link to="/recovery">
          <Button size="sm" variant="outline" className="w-full">
            Log Metrics
          </Button>
        </Link>
      </div>
    );
  }

  const score = readiness.score || 0;
  const data = [{ value: score }, { value: 100 - score }];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">Readiness</h3>
      
      {/* Gauge */}
      <div className="relative h-40 flex items-center justify-center">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius={50}
              outerRadius={70}
              dataKey="value"
            >
              <Cell fill={readiness.color} />
              <Cell fill="hsl(var(--secondary))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute text-center">
          <p className="text-4xl font-bold text-foreground">{score}</p>
          <p className="text-xs text-muted-foreground">/ 100</p>
        </div>
      </div>

      {/* Label & Description */}
      <div>
        <p className="text-sm font-semibold text-foreground">{readiness.label}</p>
        <p className="text-xs text-muted-foreground mt-1">{readiness.description}</p>
      </div>

      {/* Signal bars */}
      <div className="space-y-1.5 pt-2 border-t border-border">
        {readiness.breakdown?.hrv_baseline && readiness.breakdown?.hrv_today && readiness.breakdown.hrv_today > 0 && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">HRV {readiness.breakdown.hrv_today}ms</span>
            <span className={readiness.breakdown.hrv_ratio && readiness.breakdown.hrv_ratio > 0 ? "text-recovery" : "text-destructive"}>
              {readiness.breakdown.hrv_ratio && readiness.breakdown.hrv_ratio > 0 ? "↑" : "↓"} {Math.abs(readiness.breakdown.hrv_ratio || 0)}%
            </span>
          </div>
        )}
        {readiness.breakdown?.sleep_hours_value && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Sleep {readiness.breakdown.sleep_hours_value}h</span>
            <span className="text-foreground">{readiness.breakdown.sleep_quality_value || readiness.breakdown.sleep_quality}</span>
          </div>
        )}
        {readiness.breakdown?.tsb_value !== undefined && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Form (TSB)</span>
            <span className={readiness.breakdown.tsb_value > 0 ? "text-recovery" : "text-foreground"}>
              {readiness.breakdown.tsb_value > 0 ? "+" : ""}{readiness.breakdown.tsb_value}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}