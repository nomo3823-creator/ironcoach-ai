import moment from "moment";
import { Link } from "react-router-dom";

const sportEmoji = { run: "🏃", bike: "🚴", swim: "🏊", brick: "⚡", strength: "💪", other: "🎯", rest: "😴" };
const sportColor = { run: "#f97316", bike: "#f59e0b", swim: "#0ea5e9", brick: "#a855f7", strength: "#22c55e", other: "#6b7280" };

export default function WeeklySnapshot({ weekWorkouts, activities, weekStart, weekEnd }) {
  const today = new Date().toLocaleDateString("en-CA");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = moment(weekStart).add(i, "days");
    const dateStr = d.format("YYYY-MM-DD");
    const planned = weekWorkouts.find(w => w.date === dateStr);
    const actual = activities.find(a => a.date === dateStr);
    const isPast = dateStr < today;
    const isToday = dateStr === today;
    return { day: days[i], date: d.date(), dateStr, planned, actual, isPast, isToday };
  });

  const completed = weekWorkouts.filter(w => w.status === "completed").length;
  const total = weekWorkouts.length;
  const compliance = total > 0 ? Math.round((completed / total) * 100) : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">This Week</h3>
        {compliance != null && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            compliance >= 80 ? "bg-green-500/10 text-green-400" : 
            compliance >= 50 ? "bg-amber-500/10 text-amber-400" : 
            "bg-red-500/10 text-red-400"
          }`}>
            {compliance}% compliance
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(({ day, date, dateStr, planned, actual, isPast, isToday }) => {
          const sport = actual?.sport || planned?.sport || "rest";
          const color = sportColor[sport] || "#6b7280";
          const isDone = actual || planned?.status === "completed";
          const isMissed = isPast && planned && planned.status === "planned" && !actual;

          return (
            <div key={dateStr} className="text-center">
              <div className="text-xs font-medium text-muted-foreground">{day}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
              <div className={`h-8 w-full rounded-lg flex items-center justify-center mt-2 text-lg ${
                isToday ? "border-2 border-primary" : "border border-border"
              }`} style={{ backgroundColor: isMissed ? "#ef444420" : isDone ? color + "30" : "transparent" }}>
                {planned || actual ? sportEmoji[sport] || "🎯" : "—"}
              </div>
              {actual && <div className="text-xs text-primary mt-1 font-semibold">{Math.round(actual.tss || actual.training_stress_score || 0)}</div>}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">{completed}/{total} sessions done</p>
        <Link to="/plan" className="text-xs text-primary hover:underline font-medium">View plan →</Link>
      </div>
    </div>
  );
}