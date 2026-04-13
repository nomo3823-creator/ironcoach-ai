import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import ReadinessGauge from "../components/ui/ReadinessGauge";
import TodayWorkoutCard from "../components/dashboard/TodayWorkoutCard";
import QuickStats from "../components/dashboard/QuickStats";
import MorningBrief from "../components/dashboard/MorningBrief";
import RecentActivities from "../components/dashboard/RecentActivities";
import CoachCheckin from "../components/dashboard/CoachCheckin";
import { checkHrvDrop, checkPoorSleepStreak, downgradeWorkout } from "@/lib/planUtils";
import { Loader2 } from "lucide-react";
import moment from "moment";

function MetricRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-foreground">{value}</span>
        {sub && <span className="text-xs text-muted-foreground ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [nextRace, setNextRace] = useState(null);
  const [profile, setProfile] = useState(null);
  const [weekStats, setWeekStats] = useState({ hours: 0, count: 0 });

  const today = moment().format("YYYY-MM-DD");
  const weekStart = moment().startOf("isoWeek").format("YYYY-MM-DD");
  const weekEnd = moment().endOf("isoWeek").format("YYYY-MM-DD");

  async function load() {
    setLoading(true);
    const [workouts, metrics, acts, races, profiles, allMetrics] = await Promise.all([
      base44.entities.PlannedWorkout.filter({ date: today }),
      base44.entities.DailyMetrics.filter({ date: today }),
      base44.entities.Activity.list("-date", 20),
      base44.entities.Race.list("date", 10),
      base44.entities.AthleteProfile.list("-created_date", 1),
      base44.entities.DailyMetrics.list("date", 20),
    ]);

    const p = profiles?.[0];
    // Onboarding gate: redirect if no profile or onboarding not complete
    if (!p || !p.onboarding_complete) {
      navigate("/onboarding");
      return;
    }

    setTodayWorkout(workouts?.[0] || null);
    setTodayMetrics(metrics?.[0] || null);
    setActivities(acts || []);
    setProfile(p);

    const future = (races || []).filter((r) => moment(r.date).isAfter(moment()));
    setNextRace(future[0] || null);

    const weekActs = (acts || []).filter((a) => a.date >= weekStart && a.date <= weekEnd);
    setWeekStats({ hours: weekActs.reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60, count: weekActs.length });

    // HRV auto-downgrade check
    const todayM = metrics?.[0];
    const todayW = workouts?.[0];
    if (todayM && todayW && todayW.status === "planned" && todayW.intensity !== "easy") {
      const { shouldDowngrade, dropPct, rollingAvg } = checkHrvDrop(todayM, allMetrics || []);
      if (shouldDowngrade) {
        const reason = `HRV is ${todayM.hrv}ms — ${dropPct}% below your 14-day average of ${rollingAvg}ms. Downgraded today's session to recovery to protect your adaptation.`;
        await downgradeWorkout(todayW, reason, "hrv_drop", `HRV: ${todayM.hrv}ms (avg: ${rollingAvg}ms)`);
      } else {
        const sleepStreak = checkPoorSleepStreak(allMetrics || []);
        if (sleepStreak >= 3) {
          await downgradeWorkout(todayW, `${sleepStreak} consecutive nights of poor/fair sleep detected. Reducing today’s load to support recovery.`, "poor_sleep", `Sleep streak: ${sleepStreak} nights`);
        }
      }
    }

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const daysToRace = nextRace ? moment(nextRace.date).diff(moment(), "days") : null;

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
          Good {greeting()}, <span className="text-primary">{currentUser?.full_name?.split(" ")[0] || "Athlete"}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{moment().format("dddd, MMMM Do")} · Week {moment().isoWeek()}</p>
      </div>

      <QuickStats stats={{ weeklyHours: weekStats.hours, daysToRace, raceName: nextRace?.name, ctl: todayMetrics?.ctl, activitiesThisWeek: weekStats.count }} />

      <CoachCheckin profile={profile} metrics={todayMetrics} workout={todayWorkout} />

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">Today's Session</h2>
            <TodayWorkoutCard workout={todayWorkout} onRefresh={load} />
          </div>
          <MorningBrief metrics={todayMetrics} workout={todayWorkout} profile={currentUser} />
          <RecentActivities activities={activities} />
        </div>

        {/* Right col */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <ReadinessGauge score={todayMetrics?.readiness_score || 0} />
            <div className="mt-5 space-y-3">
              <MetricRow label="HRV" value={todayMetrics?.hrv ? `${todayMetrics.hrv}ms` : "—"} />
              <MetricRow label="Resting HR" value={todayMetrics?.resting_hr ? `${todayMetrics.resting_hr}bpm` : "—"} />
              <MetricRow label="Sleep" value={todayMetrics?.sleep_hours ? `${todayMetrics.sleep_hours}h` : "—"} sub={todayMetrics?.sleep_quality} />
              <MetricRow label="Body Battery" value={todayMetrics?.body_battery ? `${todayMetrics.body_battery}/100` : "—"} />
              <MetricRow label="TSB (Form)" value={todayMetrics?.tsb != null ? todayMetrics.tsb : "—"} />
              <MetricRow label="SpO2" value={todayMetrics?.spo2 ? `${todayMetrics.spo2}%` : "—"} />
            </div>
          </div>

          {nextRace && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏁</span>
                <h3 className="text-sm font-semibold text-foreground">{nextRace.name}</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">{nextRace.priority}</span>
              </div>
              <div className="text-3xl font-bold text-accent">{daysToRace} <span className="text-sm font-normal text-muted-foreground">days</span></div>
              <p className="text-xs text-muted-foreground mt-1">{moment(nextRace.date).format("MMM D, YYYY")} · {nextRace.distance === "140.6" ? "Full Ironman" : "70.3"}{nextRace.location ? ` · ${nextRace.location}` : ""}</p>
              {nextRace.readiness_score > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Race Readiness</span>
                    <span className="font-medium text-foreground">{nextRace.readiness_score}%</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${nextRace.readiness_score}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}