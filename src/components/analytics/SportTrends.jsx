import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { sportColors } from "@/lib/sportUtils";
import moment from "moment";

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(222 40% 9%)",
  border: "1px solid hsl(222 20% 16%)",
  borderRadius: "8px",
  color: "hsl(210 40% 96%)",
  fontSize: 12,
};

export default function SportTrends({ activities = [] }) {
  const [sport, setSport] = useState("run");

  const data = useMemo(() =>
    activities
      .filter((a) => a.sport === sport)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((a) => ({
        date: moment(a.date).format("MMM D"),
        "Distance (km)": a.distance_km || 0,
        "Avg HR": a.avg_hr || 0,
        "Power (W)": a.avg_power || 0,
      })),
    [activities, sport]
  );

  const c = sportColors[sport];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Sport Trends</h3>
        <div className="flex gap-1.5">
          {["swim", "bike", "run"].map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize"
              style={sport === s
                ? { backgroundColor: sportColors[s].hex + "20", color: sportColors[s].hex, border: `1px solid ${sportColors[s].hex}40` }
                : { color: "hsl(215 20% 55%)", border: "1px solid hsl(222 20% 16%)" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {!data.length ? (
        <p className="text-sm text-muted-foreground py-10 text-center">No {sport} activities logged yet.</p>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 14%)" />
              <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="Distance (km)" stroke={c.hex} strokeWidth={2} dot={{ r: 3, fill: c.hex }} />
              <Line type="monotone" dataKey="Avg HR" stroke="hsl(215 20% 45%)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}