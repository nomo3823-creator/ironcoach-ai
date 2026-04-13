import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReadinessCard from "../components/analytics/ReadinessCard";
import OverviewTab from "../components/analytics/OverviewTab";
import LoadTab from "../components/analytics/LoadTab";
import RunningTab from "../components/analytics/RunningTab";
import CyclingTab from "../components/analytics/CyclingTab";
import SwimTab from "../components/analytics/SwimTab";
import RecoveryTab from "../components/analytics/RecoveryTab";
import RecordsTab from "../components/analytics/RecordsTab";
import ActivitiesTab from "../components/analytics/ActivitiesTab";
import RacePredictor from "../components/analytics/RacePredictor";
import { calculateReadiness } from "../lib/readinessEngine";

export default function Analytics() {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, a, p] = await Promise.all([
        base44.entities.DailyMetrics.filter({ created_by: currentUser.email }, "date", 500),
        base44.entities.Activity.filter({ created_by: currentUser.email }, "-date", 500),
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1),
      ]);
      setMetrics(m || []);
      setActivities(a || []);
      setProfile(p?.[0] || null);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const readiness = calculateReadiness(metrics, activities);
  const hasSports = {
    run: activities.some(a => a.sport === "run"),
    bike: activities.some(a => a.sport === "bike"),
    swim: activities.some(a => a.sport === "swim"),
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Performance hub — every metric, in context.</p>
      </div>

      {/* Readiness card — always at the top */}
      <ReadinessCard readiness={readiness} />

      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary flex-wrap h-auto gap-0.5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="load">Load</TabsTrigger>
          {hasSports.run && <TabsTrigger value="running">Running</TabsTrigger>}
          {hasSports.bike && <TabsTrigger value="cycling">Cycling</TabsTrigger>}
          {hasSports.swim && <TabsTrigger value="swim">Swim</TabsTrigger>}
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="predictor">Predictor</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <OverviewTab metrics={metrics} activities={activities} profile={profile} />
        </TabsContent>
        <TabsContent value="load" className="mt-5">
          <LoadTab metrics={metrics} activities={activities} />
        </TabsContent>
        <TabsContent value="running" className="mt-5">
          <RunningTab activities={activities} metrics={metrics} profile={profile} />
        </TabsContent>
        <TabsContent value="cycling" className="mt-5">
          <CyclingTab activities={activities} metrics={metrics} profile={profile} />
        </TabsContent>
        <TabsContent value="swim" className="mt-5">
          <SwimTab activities={activities} metrics={metrics} profile={profile} />
        </TabsContent>
        <TabsContent value="recovery" className="mt-5">
          <RecoveryTab metrics={metrics} />
        </TabsContent>
        <TabsContent value="records" className="mt-5">
          <RecordsTab activities={activities} metrics={metrics} />
        </TabsContent>
        <TabsContent value="activities" className="mt-5">
          <ActivitiesTab activities={activities} />
        </TabsContent>
        <TabsContent value="predictor" className="mt-5">
          <RacePredictor activities={activities} metrics={metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}