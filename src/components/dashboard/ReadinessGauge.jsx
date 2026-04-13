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

      {/* Signal bars — render only when we have real values to show */}
      {(() => {
        const b = readiness.breakdown || {};
        const hasHrv = b.hrv_baseline && b.hrv_today > 0;
        const hasSleep = b.sleep_hours_value > 0;
        const hasTsb = typeof b.tsb_value === 'number' && b.tsb_value !== 0;
        if (!hasHrv && !hasSleep && !hasTsb) return null;
        return (
          <div className="space-y-1.5 pt-2 border-t border-border">
            {hasHrv && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">HRV {b.hrv_today}ms</span>
                <span className={b.hrv_ratio > 0 ? "text-recovery" : "text-destructive"}>
                  {b.hrv_ratio > 0 ? "↑" : "↓"} {Math.abs(b.hrv_ratio || 0)}%
                </span>
              </div>
            )}
            {hasSleep && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Sleep {b.sleep_hours_value}h</span>
                <span className="text-foreground">{b.sleep_quality_value || b.sleep_quality}</span>
              </div>
            )}
            {hasTsb && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Form (TSB)</span>
                <span className={b.tsb_value > 0 ? "text-recovery" : "text-foreground"}>
                  {b.tsb_value > 0 ? "+" : ""}{b.tsb_value}
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}