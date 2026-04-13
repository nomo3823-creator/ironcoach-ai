import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FitnessChart from "../components/analytics/FitnessChart";
import SportTrends from "../components/analytics/SportTrends";
import RecoveryTrends from "../components/analytics/RecoveryTrends";
import ZoneDistribution from "../components/analytics/ZoneDistribution";

export default function Analytics() {
  const { currentUser } = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [m, a] = await Promise.all([
        base44.entities.DailyMetrics.filter({ created_by: currentUser.email }, "date", 500),
        base44.entities.Activity.filter({ created_by: currentUser.email }, "-date", 500),
      ]);
      setMetrics(m || []);
      setActivities(a || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Performance trends and training load analysis</p>
      </div>
      <Tabs defaultValue="fitness">
        <TabsList className="bg-secondary">
          <TabsTrigger value="fitness">Fitness & Form</TabsTrigger>
          <TabsTrigger value="sports">Sport Trends</TabsTrigger>
          <TabsTrigger value="recovery">Recovery</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
        </TabsList>
        <TabsContent value="fitness" className="mt-5"><FitnessChart metrics={metrics} /></TabsContent>
        <TabsContent value="sports" className="mt-5"><SportTrends activities={activities} /></TabsContent>
        <TabsContent value="recovery" className="mt-5"><RecoveryTrends metrics={metrics} /></TabsContent>
        <TabsContent value="zones" className="mt-5"><ZoneDistribution activities={activities} /></TabsContent>
      </Tabs>
    </div>
  );
}