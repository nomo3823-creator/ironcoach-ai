import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function Strength() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser]);

  async function loadData() {
    try {
      const [pData] = await Promise.all([
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }),
      ]);
      setProfile(pData?.[0] || null);
    } catch (err) {
      console.error("Failed to load Strength data:", err);
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
        <h1 className="text-3xl font-bold text-foreground">Strength & Conditioning</h1>
        <p className="text-muted-foreground text-sm mt-1">Build power and prevent injuries</p>
      </div>

      <Card className="bg-secondary/30 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">This Week's Strength Sessions</h2>
        <p className="text-sm text-muted-foreground">AI-generated strength plan based on your training phase</p>
        <Button>Generate Weekly Plan</Button>
      </Card>

      <Card className="bg-secondary/30 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Daily Mobility</h2>
        <p className="text-sm text-muted-foreground">Targeted flexibility work for your sport</p>
        <Button variant="outline">View Today's Routine</Button>
      </Card>

      <Card className="bg-secondary/30 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Injury Prevention</h2>
        <p className="text-sm text-muted-foreground">Prehab exercises based on your history</p>
        <Button variant="outline">View Exercises</Button>
      </Card>
    </div>
  );
}