import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from "recharts";
import { PieChart, Pie, Legend } from "recharts";
import moment from "moment";
import DailyRecommendationWidget from "./DailyRecommendationWidget";

const tooltipStyle = { background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8, fontSize: 12 };

export default function CyclingTab({ activities, metrics, profile }) {
  const seen = new Set();
  const rides = activities
    .filter(a => a.sport === "bike" && a.date)
    .filter(r => {
      const key = `${r.date}-${r.external_id || r.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date > b.date ? 1 : -1);
  const ftp = profile?.current_ftp;

  // NP trend
  const npTrend = rides.filter(r => r.normalized_power).slice(-30).map(r => ({
    date: moment(r.date).format("MMM D"),
    np: r.normalized_power,
    avgPower: r.avg_power,
  }));

  // Intensity factor distribution
  const ifData = rides.filter(r => r.intensity_factor).map(r => ({
    date: moment(r.date).format("MMM D"),
    if: parseFloat(r.intensity_factor.toFixed(2)),
    color: r.intensity_factor > 1.0 ? "#ef4444" : r.intensity_factor > 0.85 ? "#f97316" : r.intensity_factor > 0.75 ? "#eab308" : "hsl(173 58% 39%)",
  }));

  // Efficiency factor trend
  const efTrend = rides.filter(r => r.efficiency_factor).slice(-30).map(r => ({
    date: moment(r.date).format("MMM D"),
    ef: parseFloat(r.efficiency_factor.toFixed(2)),
  }));

  // Variability index per ride
  const viData = rides.filter(r => r.variability_index).slice(-20).map(r => ({
    date: moment(r.date).format("MMM D"),
    vi: parseFloat(r.variability_index.toFixed(2)),
    high: r.variability_index > 1.1,
  }));

  // Zone distribution from intensity factor
  const last30Rides = rides.filter(r => moment(r.date).isAfter(moment().subtract(30, "days")));
  const zones = [
    last30Rides.reduce((s, r) => s + (r.hr_zone_1_min || 0), 0),
    last30Rides.reduce((s, r) => s + (r.hr_zone_2_min || 0), 0),
    last30Rides.reduce((s, r) => s + (r.hr_zone_3_min || 0), 0),
    last30Rides.reduce((s, r) => s + (r.hr_zone_4_min || 0), 0),
    last30Rides.reduce((s, r) => s + (r.hr_zone_5_min || 0), 0),
  ];
  const totalZoneMins = zones.reduce((s, v) => s + v, 0);
  const zonePieData = zones.map((v, i) => ({ name: `Z${i + 1}`, value: v })).filter(z => z.value > 0);
  const zoneColors = ["hsl(199 89% 48%)", "hsl(173 58% 39%)", "hsl(38 92% 50%)", "hsl(12 76% 61%)", "hsl(0 72% 51%)"];

  if (rides.length === 0) {
    return (
      <div className="space-y-4">
        <DailyRecommendationWidget sport="bike" activities={activities} metrics={metrics} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">No cycling data synced yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DailyRecommendationWidget sport="bike" activities={activities} metrics={metrics} />

      {/* NP trend */}
      {npTrend.length > 2 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-sm text-foreground">Normalized Power Trend</h3>
          <p className="text-xs text-muted-foreground">NP rising at similar duration = improving fitness.{ftp ? ` Your FTP: ${ftp}W` : ""}</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={npTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v}W`, ""]} />
              {ftp && <Line y={ftp} dataKey={() => ftp} stroke="#eab308" strokeDasharray="3 3" dot={false} name="FTP" />}
              <Line type="monotone" dataKey="np" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 2 }} name="NP" />
              <Line type="monotone" dataKey="avgPower" stroke="hsl(199 89% 48%)" strokeWidth={1.5} dot={false} name="Avg Power" strokeOpacity={0.6} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* IF distribution */}
        {ifData.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Intensity Factor per Ride</h3>
            <p className="text-xs text-muted-foreground">IF = NP ÷ FTP. 0.75–0.85 = zone 3, above 0.9 = threshold+</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={ifData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 1.2]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="if" radius={[3, 3, 0, 0]}>
                  {ifData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Efficiency factor */}
        {efTrend.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Efficiency Factor Trend</h3>
            <p className="text-xs text-muted-foreground">Rising EF = more power per heartbeat = aerobic fitness improving.</p>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={efTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => [v, "EF"]} />
                <Line type="monotone" dataKey="ef" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Variability index */}
        {viData.length > 2 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">Variability Index per Ride</h3>
            <p className="text-xs text-muted-foreground">Yellow = above 1.1 (choppy power). Ideal: as close to 1.0 as possible.</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={viData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(215 20% 55%)" }} />
                <YAxis domain={[0.9, 1.3]} tick={{ fontSize: 10, fill: "hsl(215 20% 55%)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="vi" radius={[3, 3, 0, 0]}>
                  {viData.map((d, i) => <Cell key={i} fill={d.high ? "#eab308" : "hsl(38 92% 50%)"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Zone distribution */}
        {zonePieData.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h3 className="font-semibold text-sm text-foreground">HR Zone Distribution (last 30 days)</h3>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={zonePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} label={({ name }) => name} labelLine={false} fontSize={10}>
                  {zonePieData.map((_, i) => <Cell key={i} fill={zoneColors[i % zoneColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} min`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}