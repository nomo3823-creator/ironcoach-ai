import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import moment from "moment";
import { getRaceLabel } from "@/lib/raceTypes";

export default function RaceCard({ race, readiness, profile }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(race.date) - new Date()) / (1000 * 60 * 60 * 24)));
  const totalDays = race.created_date ? Math.max(1, Math.ceil((new Date(race.date) - new Date(race.created_date)) / (1000 * 60 * 60 * 24))) : 84;
  const daysElapsed = totalDays - daysLeft;
  const progressPercent = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

  const phases = ["Base", "Build", "Peak", "Taper", "Race"];
  const phaseDuration = totalDays / phases.length;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Next Race</p>
        <h3 className="text-2xl font-bold text-foreground mt-1">{race.name}</h3>
      </div>

      <div className="text-center py-2">
        <p className="text-4xl font-bold text-accent">{daysLeft}</p>
        <p className="text-sm text-muted-foreground">days to go</p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{moment(race.date).format("MMM D, YYYY")}</span>
          <span>{getRaceLabel(race.race_type || race.distance)}</span>
        </div>
        {race.location && <p className="text-xs text-muted-foreground">{race.location}</p>}
      </div>

      {/* Phase timeline */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Training Phase</p>
        <div className="flex items-center gap-1 text-xs">
          {phases.map((phase, i) => (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full transition-colors ${
                daysElapsed > phaseDuration * i && daysElapsed <= phaseDuration * (i + 1) ? "bg-primary" : daysElapsed > phaseDuration * (i + 1) ? "bg-teal-600" : "bg-secondary"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Predicted readiness */}
      {readiness && (
        <div className="bg-secondary/30 rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">Race Readiness</p>
          <p className="text-2xl font-bold text-recovery">{readiness.score}%</p>
          <p className="text-xs text-muted-foreground">Current readiness</p>
        </div>
      )}

      <Link to="/race" className="w-full">
        <Button className="w-full">View race plan</Button>
      </Link>
    </div>
  );
}