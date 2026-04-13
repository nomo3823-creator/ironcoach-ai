import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useImport } from "@/lib/ImportContext";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DashboardHero from "@/components/dashboard/DashboardHero";
import ReadinessGauge from "@/components/dashboard/ReadinessGauge";
import TodaySessionCard from "@/components/dashboard/TodaySessionCard";
import QuickStats from "@/components/dashboard/QuickStats";
import WeekAtAGlance from "@/components/dashboard/WeekAtAGlance";
import CoachCheckin from "@/components/dashboard/CoachCheckin";
import StravaActivityFeed from "@/components/dashboard/StravaActivityFeed";
import TrainingLoadChart from "@/components/dashboard/TrainingLoadChart";
import RaceCard from "@/components/dashboard/RaceCard";
import WeeklySnapshot from "@/components/dashboard/WeeklySnapshot";
import ReadinessBreakdown from "@/components/ReadinessBreakdown";
import { calculateReadiness } from "@/lib/readinessEngine";
import { getActivityTSS } from "@/lib/planUtils";
import { getEffectiveTodayMetrics } from "@/lib/metricsUtils";
import moment from "moment";

const SkeletonSection = () => (
  <div className="space-y-2">
    <div className="h-6 bg-secondary/30 rounded w-3/4 animate-pulse" />
    <div className="h-20 bg-secondary/20 rounded animate-pulse" />
  </div>
);

export default function Dashboard() {
  const { currentUser, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const { lastImportedAt, importVersion } = useImport();
  const [profile, setProfile] = useState(null);
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [metricsDate, setMetricsDate] = useState(null);
  const [activities, setActivities] = useState([]);
  const [plannedWorkout, setPlannedWorkout] = useState(null);
  const [race, setRace] = useState(null);
  const [pendingRecs, setPendingRecs] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [weekWorkouts, setWeekWorkouts] = useState([]);
  const [allMetrics, setAllMetrics] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const todayStr = () => new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    if (!currentUser || isLoadingAuth) return;
    loadDashboardData();
  }, [currentUser, isLoadingAuth, lastImportedAt, importVersion]);

  async function loadDashboardData() {
    try {
      const today = todayStr();
      const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
      const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');

      // First try today's metrics
      let metricsResult = await base44.entities.DailyMetrics.filter({ 
        date: today, 
        created_by: currentUser.email 
      });
      
      // If nothing for today, get the most recent record (last 3 days)
      if (!metricsResult || metricsResult.length === 0) {
        const recent = await base44.entities.DailyMetrics.filter(
          { created_by: currentUser.email },
          '-date',
          3
        );
        metricsResult = recent || [];
      }

      const [profileData, activitiesData, raceData, recData, journalData, weekWorkoutsData, allMetricsData] = await Promise.all([
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1),
        base44.entities.Activity.filter({ created_by: currentUser.email }, "-date", 20),
        base44.entities.Race.filter({ created_by: currentUser.email }, "date", 10),
        base44.entities.PlanRecommendation.filter({ created_by: currentUser.email, status: "pending" }),
        base44.entities.JournalEntry.filter({ created_by: currentUser.email }, "-entry_date", 5),
        base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }),
        base44.entities.DailyMetrics.filter({ created_by: currentUser.email }, "-date", 30),
      ]);

      setProfile(profileData[0] || null);
      // Merge today's row with most-recent non-null values so HRV/sleep/RHR
      // tiles show yesterday's numbers when Apple Health hasn't synced today
      // yet. Manual check-in fields (mood, legs_feeling, energy_level, etc.)
      // from today's row always win.
      const effective = getEffectiveTodayMetrics(metricsResult[0], allMetricsData || []);
      setTodayMetrics(effective);
      setMetricsDate(effective?.date || null);
      setActivities(activitiesData || []);
      setRace(raceData?.sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null);
      setPendingRecs(recData || []);
      setJournalEntries(journalData || []);
      setWeekWorkouts(weekWorkoutsData?.filter(w => w.date >= weekStart && w.date <= weekEnd) || []);
      setAllMetrics(allMetricsData || []);

      // Calculate readiness
      const readinessScore = calculateReadiness(allMetricsData, activitiesData);
      setReadiness(readinessScore);

      // Load today's planned workout
      const planned = weekWorkoutsData?.find(w => w.date === today) || null;
      setPlannedWorkout(planned);
    } catch (err) {
      toast.error("Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const weekStart = moment().startOf('isoWeek').format('YYYY-MM-DD');
  const weekEnd = moment().endOf('isoWeek').format('YYYY-MM-DD');
  const weekActs = activities.filter(a => a.date >= weekStart && a.date <= weekEnd);
  const nextRace = race;
  const daysToRace = nextRace ? Math.max(0, Math.ceil((new Date(nextRace.date) - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const todayPendingRec = pendingRecs.find(r => r.workout_date === todayStr());

  const stats = {
    weeklyHours: weekActs.reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60,
    plannedHours: weekWorkouts.reduce((s, w) => s + (w.duration_minutes || 0), 0) / 60,
    daysToRace,
    raceName: nextRace?.name,
    activitiesThisWeek: weekActs.length,
    weeklyTSS: weekActs.reduce((s, a) => s + getActivityTSS(a), 0),
    pendingRecsCount: pendingRecs.length,
    readinessScore: todayMetrics?.readiness_score,
    weekCompliance: weekWorkouts.length > 0 ? Math.round((weekWorkouts.filter(w => w.status === "completed").length / weekWorkouts.length) * 100) : null,
    tsb: todayMetrics?.tsb,
  };

  if (isLoadingAuth || loading) {
    return (
      <div className="p-6 space-y-8">
        <SkeletonSection />
        <SkeletonSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: 2-column layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        {/* LEFT COLUMN (wider) */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardHero profile={profile} race={race} readiness={readiness} currentUser={currentUser} />
          <QuickStats stats={stats} />
          {pendingRecs.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{pendingRecs.length} coach recommendation{pendingRecs.length > 1 ? "s" : ""} waiting</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pendingRecs[0]?.workout_title || "Session"} · {pendingRecs[0]?.reason?.substring(0, 60)}…</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/today")} className="shrink-0">Review →</Button>
            </div>
          )}
          <TodaySessionCard workout={plannedWorkout} readiness={readiness} activities={activities} onRefresh={loadDashboardData} pendingRec={todayPendingRec} />
          <CoachCheckin profile={profile} metrics={todayMetrics} workout={plannedWorkout} journalEntries={journalEntries} pendingRecs={pendingRecs} weekWorkouts={weekWorkouts} />
          <StravaActivityFeed activities={activities} />
          <WeeklySnapshot weekWorkouts={weekWorkouts} activities={weekActs} weekStart={weekStart} weekEnd={weekEnd} />
          {journalEntries.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Latest Journal Entry</h3>
                <a href="/journal" className="text-xs text-primary hover:underline">View all →</a>
              </div>
              <div className="space-y-3">
                {journalEntries.slice(0, 2).map((entry) => (
                  <div key={entry.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-primary capitalize">{entry.entry_type?.replace("_", " ") || "Entry"}</span>
                      <span className="text-xs text-muted-foreground">{moment(entry.entry_date).fromNow()}</span>
                    </div>
                    {entry.feeling_rating && <span className="text-lg ml-0">{["😫","😕","😐","🙂","😊"][entry.feeling_rating - 1]}</span>}
                    <p className="text-sm text-muted-foreground mt-1">{typeof entry.content === "string" ? entry.content.substring(0, 120) : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <ReadinessGauge readiness={readiness} />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full"
          >
            {showBreakdown ? "Hide breakdown" : "View breakdown"}
          </Button>
          {showBreakdown && <ReadinessBreakdown readiness={readiness} />}
          <WeekAtAGlance activities={activities} />
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <a href="/nutrition" className="rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 p-4 text-center transition-colors">
                <div className="text-2xl mb-2">🥗</div>
                <p className="text-xs font-semibold text-foreground">Nutrition</p>
                <p className="text-xs text-muted-foreground mt-1">{plannedWorkout ? `Fueling for ${plannedWorkout.duration_minutes}min ${plannedWorkout.sport}` : "Rest day fueling guide"}</p>
                <p className="text-xs text-primary mt-2 font-medium">View guide →</p>
              </a>
              <a href="/recovery" className="rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 p-4 text-center transition-colors">
                <div className="text-2xl mb-2">💚</div>
                <p className="text-xs font-semibold text-foreground">Recovery</p>
                <p className="text-xs text-muted-foreground mt-1">{todayMetrics?.readiness_score ? "Check-in done ✓" : "Morning check-in pending"}</p>
                <p className="text-xs text-primary mt-2 font-medium">{todayMetrics?.readiness_score ? "View metrics →" : "Check in now →"}</p>
              </a>
            </div>
          </div>
          {race && <RaceCard race={race} readiness={readiness} profile={profile} />}
        </div>
      </div>

      {/* Mobile: single column */}
      <div className="lg:hidden space-y-6 p-4">
        <DashboardHero profile={profile} race={race} readiness={readiness} currentUser={currentUser} />
        <QuickStats stats={stats} />
        {pendingRecs.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{pendingRecs.length} coach recommendation{pendingRecs.length > 1 ? "s" : ""} waiting</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pendingRecs[0]?.workout_title || "Session"} · {pendingRecs[0]?.reason?.substring(0, 60)}…</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/today")} className="shrink-0">Review →</Button>
          </div>
        )}
        <TodaySessionCard workout={plannedWorkout} readiness={readiness} activities={activities} onRefresh={loadDashboardData} pendingRec={todayPendingRec} />
        <CoachCheckin profile={profile} metrics={todayMetrics} workout={plannedWorkout} journalEntries={journalEntries} pendingRecs={pendingRecs} weekWorkouts={weekWorkouts} />
        <WeekAtAGlance activities={activities} />
        <StravaActivityFeed activities={activities} />
        <WeeklySnapshot weekWorkouts={weekWorkouts} activities={weekActs} weekStart={weekStart} weekEnd={weekEnd} />
        {journalEntries.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Latest Journal Entry</h3>
              <a href="/journal" className="text-xs text-primary hover:underline">View all →</a>
            </div>
            <div className="space-y-3">
              {journalEntries.slice(0, 2).map((entry) => (
                <div key={entry.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-primary capitalize">{entry.entry_type?.replace("_", " ") || "Entry"}</span>
                    <span className="text-xs text-muted-foreground">{moment(entry.entry_date).fromNow()}</span>
                  </div>
                  {entry.feeling_rating && <span className="text-lg ml-0">{["😫","😕","😐","🙂","😊"][entry.feeling_rating - 1]}</span>}
                  <p className="text-sm text-muted-foreground mt-1">{typeof entry.content === "string" ? entry.content.substring(0, 120) : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {race && <RaceCard race={race} readiness={readiness} profile={profile} />}
      </div>
    </div>
  );
}