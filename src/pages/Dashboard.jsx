import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import DashboardHero from "@/components/dashboard/DashboardHero";
import ReadinessGauge from "@/components/dashboard/ReadinessGauge";
import TodaySessionCard from "@/components/dashboard/TodaySessionCard";
import StatCards from "@/components/dashboard/StatCards";
import WeekAtAGlance from "@/components/dashboard/WeekAtAGlance";
import MorningBrief from "@/components/dashboard/MorningBrief";
import StravaActivityFeed from "@/components/dashboard/StravaActivityFeed";
import TrainingLoadChart from "@/components/dashboard/TrainingLoadChart";
import RaceCard from "@/components/dashboard/RaceCard";
import PendingRecommendationsBanner from "@/components/dashboard/PendingRecommendationsBanner";
import { calculateReadiness } from "@/lib/readinessEngine";

const SkeletonSection = () => (
  <div className="space-y-2">
    <div className="h-6 bg-secondary/30 rounded w-3/4 animate-pulse" />
    <div className="h-20 bg-secondary/20 rounded animate-pulse" />
  </div>
);

export default function Dashboard() {
  const { currentUser, isLoadingAuth } = useAuth();
  const [profile, setProfile] = useState(null);
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [plannedWorkout, setPlannedWorkout] = useState(null);
  const [race, setRace] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || isLoadingAuth) return;
    loadDashboardData();
  }, [currentUser, isLoadingAuth]);

  async function loadDashboardData() {
    try {
      const [profileData, metricsData, activitiesData, raceData, recData] = await Promise.all([
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }),
        base44.entities.DailyMetrics.filter({ date: todayStr() }),
        base44.entities.Activity.filter({ created_by: currentUser.email }),
        base44.entities.Race.filter({ created_by: currentUser.email }),
        base44.entities.PlanRecommendation.filter({ created_by: currentUser.email, status: "pending" }),
      ]);

      setProfile(profileData[0] || null);
      setTodayMetrics(metricsData[0] || null);
      setActivities(activitiesData || []);
      setRace(raceData?.sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null);
      setRecommendations(recData || []);

      // Calculate readiness
      const allMetrics = await base44.entities.DailyMetrics.filter({ created_by: currentUser.email });
      const readinessScore = calculateReadiness(allMetrics, activitiesData);
      setReadiness(readinessScore);

      // Load today's planned workout
      const planned = await base44.entities.PlannedWorkout.filter({ date: todayStr() });
      setPlannedWorkout(planned[0] || null);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const todayStr = () => new Date().toISOString().split("T")[0];

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
          <DashboardHero profile={profile} race={race} readiness={readiness} />
          {recommendations.length > 0 && <PendingRecommendationsBanner recommendations={recommendations} />}
          <TodaySessionCard workout={plannedWorkout} readiness={readiness} activities={activities} />
          <MorningBrief profile={profile} metrics={todayMetrics} activities={activities} readiness={readiness} />
          <StravaActivityFeed activities={activities} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <ReadinessGauge readiness={readiness} />
          <StatCards profile={profile} metrics={todayMetrics} activities={activities} race={race} />
          <WeekAtAGlance activities={activities} />
          <TrainingLoadChart activities={activities} />
          {race && <RaceCard race={race} readiness={readiness} profile={profile} />}
        </div>
      </div>

      {/* Mobile: single column */}
      <div className="lg:hidden space-y-6 p-4">
        <DashboardHero profile={profile} race={race} readiness={readiness} />
        {recommendations.length > 0 && <PendingRecommendationsBanner recommendations={recommendations} />}
        <TodaySessionCard workout={plannedWorkout} readiness={readiness} activities={activities} />
        <StatCards profile={profile} metrics={todayMetrics} activities={activities} race={race} />
        <WeekAtAGlance activities={activities} />
        <MorningBrief profile={profile} metrics={todayMetrics} activities={activities} readiness={readiness} />
        <TrainingLoadChart activities={activities} />
        <StravaActivityFeed activities={activities} />
        {race && <RaceCard race={race} readiness={readiness} profile={profile} />}
      </div>
    </div>
  );
}