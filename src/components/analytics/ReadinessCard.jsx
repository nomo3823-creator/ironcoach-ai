import { cn } from "@/lib/utils";
import { getBand } from "@/lib/readinessEngine";

function GaugeArc({ score, color }) {
  const r = 52, cx = 64, cy = 64;
  const circumference = Math.PI * r; // half circle
  const startAngle = Math.PI; // 180deg (left)
  const pct = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - pct);

  return (
    <svg width="128" height="80" viewBox="0 0 128 80" className="overflow-visible">
      {/* Background arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="hsl(222 20% 16%)" strokeWidth="10" strokeLinecap="round"
      />
      {/* Score arc */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="28" fontWeight="700" fontFamily="monospace">
        {score ?? "--"}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(215 20% 55%)" fontSize="11">
        / 100
      </text>
    </svg>
  );
}

function SignalBar({ label, value, maxValue, color, detail }) {
  const pct = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="space-y-1 flex-1 min-w-0">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</span>
        {detail && <span className="text-[10px] text-muted-foreground">{detail}</span>}
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function ReadinessCard({ readiness }) {
  if (!readiness?.hasData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="w-32 shrink-0 flex items-center justify-center h-20">
          <div className="text-4xl font-bold text-muted-foreground/30">--</div>
        </div>
        <div>
          <p className="font-semibold text-foreground">No readiness data yet</p>
          <p className="text-xs text-muted-foreground mt-1">Log your daily metrics (HRV, sleep, HR) to unlock your readiness score.</p>
        </div>
      </div>
    );
  }

  const { score, label, color, description, breakdown } = readiness;
  const band = getBand(score);

  const signals = [
    { label: "HRV", value: breakdown.hrv, max: 15, detail: breakdown.hrv_today ? `${breakdown.hrv_today}ms` : null },
    { label: "Sleep", value: breakdown.sleep_hours + breakdown.sleep_quality, max: 20, detail: null },
    { label: "Battery", value: breakdown.body_battery, max: 10, detail: null },
    { label: "Form (TSB)", value: breakdown.tsb, max: 20, detail: breakdown.tsb_value !== undefined ? `${breakdown.tsb_value > 0 ? "+" : ""}${breakdown.tsb_value}` : null },
    { label: "Load", value: breakdown.yesterday_tss, max: 15, detail: breakdown.yesterday_tss_value ? `${breakdown.yesterday_tss_value} TSS` : null },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="shrink-0 flex flex-col items-center">
          <GaugeArc score={score} color={color} />
          <div className="mt-1 px-3 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: `${color}20`, color }}>
            {label}
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-3 w-full">
          <p className="text-sm text-foreground leading-snug">{description}</p>
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            {signals.map(s => (
              <SignalBar key={s.label} label={s.label} value={s.value} maxValue={s.max} color={color} detail={s.detail} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}