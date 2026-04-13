import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import moment from "moment";

export default function RaceHub() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [upcomingRaces, setUpcomingRaces] = useState([]);
  const [pastRaces, setPastRaces] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    loadRaces();
  }, [currentUser]);

  async function loadRaces() {
    try {
      const races = await base44.entities.Race.filter({ created_by: currentUser.email });
      const today = new Date();
      setUpcomingRaces(races.filter(r => new Date(r.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date)));
      setPastRaces(races.filter(r => new Date(r.date) < today).sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (err) {
      console.error("Failed to load races:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Race Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Plan, predict, and track your races</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">Upcoming ({upcomingRaces.length})</TabsTrigger>
          <TabsTrigger value="past">Past Races ({pastRaces.length})</TabsTrigger>
          <TabsTrigger value="predictor">Predictor</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingRaces.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
              <p className="text-foreground font-semibold">No upcoming races</p>
              <p className="text-sm text-muted-foreground">Add a race to start planning</p>
              <Button>Create Race</Button>
            </div>
          ) : (
            upcomingRaces.map(race => (
              <div key={race.id} className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{race.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{moment(race.date).format("MMM D, YYYY")}</p>
                  </div>
                  <Badge>{race.priority || "C"} Priority</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{race.location}</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">
                    View Plan
                  </Button>
                  {Math.ceil((new Date(race.date) - new Date()) / (1000 * 60 * 60 * 24)) <= 14 && (
                    <Button variant="outline" className="flex-1">
                      Race Week Plan
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {pastRaces.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
              <p>No past races yet</p>
            </div>
          ) : (
            pastRaces.map(race => (
              <div key={race.id} className="rounded-2xl border border-border bg-card p-6 space-y-3">
                <h3 className="text-lg font-bold text-foreground">{race.name}</h3>
                <p className="text-sm text-muted-foreground">{moment(race.date).format("MMM D, YYYY")}</p>
                <Button variant="outline" className="w-full">
                  Log Result
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="predictor" className="text-center text-muted-foreground p-8">
          <p>Race predictor coming soon</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}