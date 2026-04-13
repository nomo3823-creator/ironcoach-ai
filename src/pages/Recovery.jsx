import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useImport } from "@/lib/ImportContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { calculateReadiness } from "@/lib/readinessEngine";
import ReadinessBreakdown from "@/components/ReadinessBreakdown";

export default function Recovery() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { importVersion } = useImport();
  const [loading, setLoading] = useState(true);
  const [todayMetrics, setTodayMetrics] = useState(null);
  const [metricsDate, setMetricsDate] = useState(null);
  const [completedCheckin, setCompletedCheckin] = useState(false);
  const [sleepQuality, setSleepQuality] = useState("");
  const [energy, setEnergy] = useState(0);
  const [legsFeel, setLegsFeel] = useState("");
  const [allMetrics, setAllMetrics] = useState([]);
  const [activities, setActivities] = useState([]);
  const [readiness, setReadiness] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    loadData();
  }, [currentUser, importVersion]);

  async function loadData() {
    try {
      const today = new Date().toISOString().split("T")[0];
      
      // First try today's metrics
      let metricsResult = await base44.entities.DailyMetrics.filter({ 
        date: today, 
        created_by: currentUser.email 
      });
      
      // If nothing for today, get the most recent record
      if (!metricsResult || metricsResult.length === 0) {
        const recent = await base44.entities.DailyMetrics.filter(
          { created_by: currentUser.email },
          '-date',
          3
        );
        metricsResult = recent || [];
      }
      
      const [activitiesData] = await Promise.all([
        base44.entities.Activity.filter({ created_by: currentUser.email }, "-date", 30),
      ]);
      
      const m = metricsResult[0];
      setTodayMetrics(m || null);
      setMetricsDate(m?.date || null);
      setCompletedCheckin(m?.morning_checkin_complete || false);
      setSleepQuality(m?.sleep_quality || "");
      setEnergy(m?.energy_level || 0);
      setLegsFeel(m?.legs_feeling || "");
      setAllMetrics(metricsResult || []);
      setActivities(activitiesData || []);
      const readinessScore = calculateReadiness(metricsResult || [], activitiesData || []);
      setReadiness(readinessScore);
    } catch (err) {
      toast.error("Failed to load Recovery data");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCheckin() {
    try {
      const today = new Date().toISOString().split("T")[0];
      if (todayMetrics?.id) {
        await base44.entities.DailyMetrics.update(todayMetrics.id, {
          sleep_quality: sleepQuality,
          energy_level: energy,
          legs_feeling: legsFeel,
          morning_checkin_complete: true,
        });
      } else {
        await base44.entities.DailyMetrics.create({
          date: today,
          sleep_quality: sleepQuality,
          energy_level: energy,
          legs_feeling: legsFeel,
          morning_checkin_complete: true,
        });
      }
      toast.success("Check-in saved successfully");
      setCompletedCheckin(true);
      await loadData();
    } catch (err) {
      toast.error("Could not save check-in");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sleepEmojis = ["😴", "😕", "😐", "🙂", "😊"];
  const sleepValues = ["poor", "fair", "good", "good", "excellent"];

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Recovery</h1>
        <p className="text-muted-foreground text-sm mt-1">Track and optimize your recovery</p>
      </div>

      {!completedCheckin ? (
        <Card className="bg-secondary/40 p-6 space-y-6 border-primary/30">
          <h2 className="text-lg font-semibold text-foreground">Morning Check-In</h2>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">How did you sleep?</p>
            <div className="flex gap-2">
              {sleepEmojis.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => setSleepQuality(sleepValues[i])}
                  className={`flex-1 p-3 rounded-lg text-2xl transition-all ${
                    sleepValues[i] === sleepQuality
                      ? "bg-primary/20 border border-primary"
                      : "bg-secondary border border-border"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">How do your legs feel?</p>
            <div className="flex gap-2 flex-wrap">
              {["Heavy", "Tired", "Normal", "Fresh", "Springy"].map(option => (
                <button
                  key={option}
                  onClick={() => setLegsFeel(option)}
                  className={`px-3 py-2 rounded-lg text-sm transition-all ${
                    legsFeel === option
                      ? "bg-primary/20 text-primary border border-primary"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Overall energy today? (1-5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  onClick={() => setEnergy(num)}
                  className={`flex-1 h-10 rounded-lg font-semibold transition-all ${
                    energy === num ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveCheckin} className="w-full">
            Save Check-In
          </Button>
        </Card>
      ) : (
        <Card className="bg-recovery/10 border border-recovery p-6 space-y-2">
          <Badge className="bg-recovery/20 text-recovery border-0 w-fit">Check-in Complete</Badge>
          <p className="text-sm text-muted-foreground">Your morning check-in has been saved. Come back tomorrow to update it.</p>
        </Card>
      )}

      {/* Readiness Breakdown */}
      <ReadinessBreakdown readiness={readiness} />

      {/* Empty state when no Apple Health data exists */}
      {!todayMetrics && allMetrics.length === 0 && (
        <Card className="bg-secondary/30 p-6 space-y-4 border-dashed">
          <div className="text-center space-y-2">
            <div className="text-4xl mb-2">🍎</div>
            <h3 className="text-lg font-semibold text-foreground">No health metrics yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Import your Apple Health data to see HRV trends, sleep analysis, and your readiness score. Takes 2-4 minutes.
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => navigate("/integrations")}>
              Import Apple Health Data
            </Button>
          </div>
        </Card>
      )}

      {/* Recovery Metrics */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Recovery Metrics</h2>
        
        {/* Show "data from" label if metrics are from a previous day */}
        {metricsDate && metricsDate !== new Date().toISOString().split("T")[0] && (
          <p className="text-xs text-muted-foreground">
            Showing data from {moment(metricsDate).format("MMM D")} — today's data not yet available
          </p>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">HRV</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.hrv && todayMetrics.hrv > 0 ? `${todayMetrics.hrv}ms` : '—'}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Sleep</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.sleep_hours && todayMetrics.sleep_hours > 0 ? `${todayMetrics.sleep_hours}h` : '—'}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Resting HR</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.resting_hr && todayMetrics.resting_hr > 0 ? `${todayMetrics.resting_hr}bpm` : '—'}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">SpO2</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.spo2 && todayMetrics.spo2 > 0 ? `${todayMetrics.spo2}%` : '—'}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Body Battery</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.body_battery && todayMetrics.body_battery > 0 ? `${todayMetrics.body_battery}/100` : '—'}
            </p>
          </Card>
          <Card className="p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Readiness</p>
            <p className="text-2xl font-bold text-foreground">
              {todayMetrics?.readiness_score && todayMetrics.readiness_score > 0 ? `${todayMetrics.readiness_score}/100` : '—'}
            </p>
          </Card>
        </div>
      </div>

      {/* Apple Health Import */}
      <Card className="bg-secondary/30 p-6 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Apple Health</h2>
        <p className="text-sm text-muted-foreground">Import your health data for better insights</p>
        <Button variant="outline" onClick={() => navigate("/integrations")}>Import Apple Health Data</Button>
      </Card>
    </div>
  );
}