import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Nutrition() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  async function loadData() {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const [twData, pData] = await Promise.all([
        base44.entities.PlannedWorkout.filter({ date: today, created_by: currentUser.email }),
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }),
      ]);
      setTodayWorkout(twData?.[0] || null);
      setProfile(pData?.[0] || null);
    } catch (err) {
      console.error("Failed to load Nutrition data:", err);
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
        <h1 className="text-3xl font-bold text-foreground">Nutrition</h1>
        <p className="text-muted-foreground text-sm mt-1">Personalized fueling for your training</p>
      </div>

      {todayWorkout && todayWorkout.duration_minutes > 60 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/10 border border-primary p-6 space-y-2">
            <p className="text-sm font-semibold text-primary">Pre-Workout</p>
            <p className="text-lg font-bold text-foreground">30-60g carbs</p>
            <p className="text-xs text-muted-foreground">2-3 hours before</p>
          </Card>
          <Card className="bg-accent/10 border border-accent p-6 space-y-2">
            <p className="text-sm font-semibold text-accent">During Workout</p>
            <p className="text-lg font-bold text-foreground">30-60g/hr</p>
            <p className="text-xs text-muted-foreground">Every 30-45 min</p>
          </Card>
          <Card className="bg-recovery/10 border border-recovery p-6 space-y-2">
            <p className="text-sm font-semibold text-recovery">Post-Workout</p>
            <p className="text-lg font-bold text-foreground">20-40g protein</p>
            <p className="text-xs text-muted-foreground">Within 30-45 min</p>
          </Card>
        </div>
      ) : (
        <Card className="bg-secondary/30 p-6 text-center text-muted-foreground">
          <p>No workout today — maintenance calories recommended</p>
        </Card>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Weekly Nutrition Overview</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Est. Calorie Burn</p>
            <p className="text-xl font-bold text-foreground">—</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Weekly TSS</p>
            <p className="text-xl font-bold text-foreground">—</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Carb Target</p>
            <p className="text-xl font-bold text-foreground">—</p>
          </div>
        </div>
      </div>
    </div>
  );
}