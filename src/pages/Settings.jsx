import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Plug, PlugZap, Watch, Activity, Bike, Heart, RotateCcw, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { RACE_TYPES } from "@/lib/raceTypes";

export default function Settings() {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({
    first_name: "", age: "", weight_kg: "", height_cm: "", sport_history: "",
    current_ftp: "", css_per_100m: "", threshold_run_pace: "",
    vo2_max: "", resting_hr: "", max_hr: "", weekly_hours_available: "",
    experience_level: "intermediate", race_type: "140.6", biggest_limiter: "",
    notification_daily_brief: true, notification_workout_reminder: true, daily_brief_time: "06:00",
    strava_connected: false, garmin_connected: false, apple_health_connected: false,
  });

  useEffect(() => {
    if (!currentUser) return;
    async function load() {
      const data = await base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1);
      if (data?.[0]) {
        setProfile(data[0]);
        setForm((prev) => ({ ...prev, ...data[0] }));
      }
      setLoading(false);
    }
    load();
  }, [currentUser]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    const data = {
      ...form,
      age: form.age ? Number(form.age) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      current_ftp: form.current_ftp ? Number(form.current_ftp) : null,
      css_per_100m: form.css_per_100m ? Number(form.css_per_100m) : null,
      vo2_max: form.vo2_max ? Number(form.vo2_max) : null,
      resting_hr: form.resting_hr ? Number(form.resting_hr) : null,
      max_hr: form.max_hr ? Number(form.max_hr) : null,
      weekly_hours_available: form.weekly_hours_available ? Number(form.weekly_hours_available) : null,
    };
    if (profile?.id) {
      await base44.entities.AthleteProfile.update(profile.id, data);
    } else {
      const created = await base44.entities.AthleteProfile.create(data);
      setProfile(created);
    }
    setSaving(false);
    toast.success("Profile saved");
  }

  function toggle(field) {
    setForm((f) => ({ ...f, [field]: !f[field] }));
  }

  async function resetOnboarding() {
    if (!window.confirm("Delete ALL your data (profile, workouts, metrics, activities, races, change log, recommendations) and restart onboarding. This cannot be undone.")) return;
    setResetting(true);
    try {
      const [workouts, metrics, activities, races, logs, recs] = await Promise.all([
        base44.entities.PlannedWorkout.filter({ created_by: currentUser.email }),
        base44.entities.DailyMetrics.filter({ created_by: currentUser.email }),
        base44.entities.Activity.filter({ created_by: currentUser.email }),
        base44.entities.Race.filter({ created_by: currentUser.email }),
        base44.entities.PlanChangeLog.filter({ created_by: currentUser.email }),
        base44.entities.PlanRecommendation.filter({ created_by: currentUser.email }),
      ]);
      await Promise.all([
        ...workouts.map(r => base44.entities.PlannedWorkout.delete(r.id)),
        ...metrics.map(r => base44.entities.DailyMetrics.delete(r.id)),
        ...activities.map(r => base44.entities.Activity.delete(r.id)),
        ...races.map(r => base44.entities.Race.delete(r.id)),
        ...logs.map(r => base44.entities.PlanChangeLog.delete(r.id)),
        ...recs.map(r => base44.entities.PlanRecommendation.delete(r.id)),
      ]);
      if (profile?.id) await base44.entities.AthleteProfile.delete(profile.id);
      toast.success("All data reset — redirecting…");
      navigate("/onboarding");
    } catch (err) {
      toast.error(`Reset failed: ${err?.message || "unknown error"}`);
      setResetting(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Athlete profile & integrations</p>
      </div>

      {/* Integrations Link */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">Integrations</h2>
        <p className="text-sm text-muted-foreground mb-4">Manage all your device connections and data integrations.</p>
        <Button variant="outline" onClick={() => navigate("/integrations")} className="w-full sm:w-auto">
          <Plug className="h-4 w-4 mr-2" /> Manage Integrations
        </Button>
      </section>

      {/* Profile form */}
      <form onSubmit={save} className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Athlete Profile</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>First Name</Label><Input value={form.first_name || ""} onChange={(e) => setForm({...form,first_name:e.target.value})} placeholder="Alex" /></div>
            <div><Label>Age</Label><Input type="number" value={form.age || ""} onChange={(e) => setForm({...form,age:e.target.value})} placeholder="32" /></div>
            <div><Label>Weight (kg)</Label><Input type="number" value={form.weight_kg || ""} onChange={(e) => setForm({...form,weight_kg:e.target.value})} placeholder="72" /></div>
            <div><Label>Height (cm)</Label><Input type="number" value={form.height_cm || ""} onChange={(e) => setForm({...form,height_cm:e.target.value})} placeholder="178" /></div>
            <div>
              <Label>Experience Level</Label>
              <Select value={form.experience_level} onValueChange={(v) => setForm({...form,experience_level:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Weekly Hours Available</Label><Input type="number" value={form.weekly_hours_available || ""} onChange={(e) => setForm({...form,weekly_hours_available:e.target.value})} placeholder="10" /></div>
            <div>
              <Label>Target Race Type</Label>
              <Select value={form.race_type || "140.6"} onValueChange={(v) => setForm({...form,race_type:v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RACE_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3"><Label>Biggest Limiter</Label><Input value={form.biggest_limiter || ""} onChange={(e) => setForm({...form,biggest_limiter:e.target.value})} placeholder="e.g. swim technique, running durability, bike FTP" /></div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Performance Benchmarks</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><Label>FTP (watts)</Label><Input type="number" value={form.current_ftp || ""} onChange={(e) => setForm({...form,current_ftp:e.target.value})} placeholder="250" /></div>
            <div><Label>CSS / 100m (seconds)</Label><Input type="number" value={form.css_per_100m || ""} onChange={(e) => setForm({...form,css_per_100m:e.target.value})} placeholder="95" /></div>
            <div><Label>Threshold Run Pace (min/km)</Label><Input value={form.threshold_run_pace || ""} onChange={(e) => setForm({...form,threshold_run_pace:e.target.value})} placeholder="4:30" /></div>
            <div><Label>VO2 Max</Label><Input type="number" value={form.vo2_max || ""} onChange={(e) => setForm({...form,vo2_max:e.target.value})} placeholder="52" /></div>
            <div><Label>Resting HR</Label><Input type="number" value={form.resting_hr || ""} onChange={(e) => setForm({...form,resting_hr:e.target.value})} placeholder="48" /></div>
            <div><Label>Max HR</Label><Input type="number" value={form.max_hr || ""} onChange={(e) => setForm({...form,max_hr:e.target.value})} placeholder="185" /></div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider">Notifications</h2>
          <div className="space-y-4">
            {[
              { key: "notification_daily_brief", label: "Daily Morning Brief", sub: "AI coaching brief each morning" },
              { key: "notification_workout_reminder", label: "Workout Reminders", sub: "Remind me about today's session" },
            ].map(({ key, label, sub }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <Switch checked={!!form[key]} onCheckedChange={() => toggle(key)} />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <Label>Brief Time</Label>
              <Input type="time" value={form.daily_brief_time || "06:00"} onChange={(e) => setForm({...form,daily_brief_time:e.target.value})} className="w-32" />
            </div>
          </div>
        </section>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : <><Save className="h-4 w-4 mr-2" />Save Profile</>}
        </Button>
      </form>

      <section className="border-t border-border pt-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Account</h2>
          <p className="text-xs text-muted-foreground mb-4">Sign out of your current session.</p>
          <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Sign Out</p>
              <p className="text-xs text-muted-foreground">Clears your session and returns you to the login screen.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => logout(true)}
              className="shrink-0"
            >
              <LogOut className="h-4 w-4 mr-2" />Sign Out
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1 uppercase tracking-wider">Developer</h2>
          <p className="text-xs text-muted-foreground mb-4">Testing utilities. Use with care.</p>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Reset Onboarding</p>
              <p className="text-xs text-muted-foreground">Deletes your athlete profile and restarts the onboarding flow.</p>
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={resetOnboarding}
              disabled={resetting}
              className="shrink-0"
            >
              {resetting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Resetting…</> : <><RotateCcw className="h-4 w-4 mr-2" />Reset Onboarding</>}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}