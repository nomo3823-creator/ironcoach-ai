import { Badge } from "@/components/ui/badge";
import moment from "moment";
import { getActivityTSS } from "@/lib/planUtils";

export default function WeekAtAGlance({ activities }) {
  const today = new Date();
  const weekStart = moment().startOf('isoWeek').toDate();

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getActivityForDate = (date) => {
    const dateStr = date.toISOString().split("T")[0];
    return activities.find(a => a.date === dateStr);
  };

  const isToday = (date) => date.toISOString().split("T")[0] === today.toISOString().split("T")[0];

  const weekActivities = week.filter(d => getActivityForDate(d)).length;
  const weekTSS = week.reduce((s, d) => {
    const a = getActivityForDate(d);
    return s + getActivityTSS(a);
  }, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">This Week</h3>

      {/* 7-day strip */}
      <div className="flex gap-1 justify-between">
        {week.map((date, i) => {
          const activity = getActivityForDate(date);
          const isTdy = isToday(date);
          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg ${
                isTdy ? "bg-primary/20 border border-primary" : "bg-secondary/30"
              }`}
            >
              <p className="text-xs font-semibold text-muted-foreground">{moment(date).format("ddd").charAt(0)}</p>
              <p className="text-xs text-foreground font-semibold">{date.getDate()}</p>
              {activity ? (
                <>
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: activity.sport === "swim" ? "#3b82f6" : activity.sport === "bike" ? "#fbbf24" : "#ef4444" }} />
                  {activity.tss > 0 && <p className="text-xs text-muted-foreground">{activity.tss}</p>}
                </>
              ) : (
                <div className="h-2 w-2 rounded-full bg-secondary" />
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
        <p>Week compliance: {weekActivities}/7 sessions</p>
        <p>Weekly TSS: {weekTSS.toFixed(0)}</p>
      </div>
    </div>
  );
}