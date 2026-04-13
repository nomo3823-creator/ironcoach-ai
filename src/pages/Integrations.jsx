import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, Link2, Link2Off, AlertCircle, Loader2, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Integrations() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    base44.entities.AthleteProfile.filter({ created_by: currentUser.email })
      .then(data => setProfile(data[0] || null));
  }, [currentUser]);

  // Check for Strava OAuth callback code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const scope = params.get("scope");
    if (code && scope) {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      handleStravaCode(code);
    }
  }, []);

  async function handleStravaCode(code) {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("stravaCallback", { code });
      toast({ title: "Strava connected!", description: `Welcome, ${res.data?.athlete?.firstname || "athlete"}!` });
      // Refresh profile
      const data = await base44.entities.AthleteProfile.filter({ created_by: currentUser.email });
      setProfile(data[0] || null);
    } catch (e) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    }
    setConnecting(false);
  }

  async function connectStrava() {
    setConnecting(true);
    try {
      const redirectUri = window.location.origin + "/integrations";
      const res = await base44.functions.invoke("stravaAuth", { redirect_uri: redirectUri });
      window.location.href = res.data.url;
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setConnecting(false);
    }
  }

  async function disconnectStrava() {
    if (!profile) return;
    await base44.entities.AthleteProfile.update(profile.id, {
      strava_connected: false,
      strava_access_token: "",
      strava_refresh_token: "",
      strava_athlete_id: "",
    });
    setProfile(p => ({ ...p, strava_connected: false }));
    toast({ title: "Strava disconnected" });
  }

  async function syncStrava() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("stravaSync", {});
      setSyncResult(res.data);
      toast({ title: `Synced ${res.data.synced} new activities from Strava` });
    } catch (e) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  }

  const stravaConnected = profile?.strava_connected;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect your devices and fitness platforms to sync your training data.</p>
      </div>

      {/* Strava */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#FC4C02]/10 flex items-center justify-center text-2xl">🏃</div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-foreground">Strava</h2>
                {stravaConnected
                  ? <Badge className="bg-recovery/20 text-recovery border-0 text-xs">Connected</Badge>
                  : <Badge variant="secondary" className="text-xs">Not connected</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Sync activities, power, HR, pace & elevation</p>
            </div>
          </div>
          {stravaConnected ? (
            <Button variant="outline" size="sm" onClick={disconnectStrava} className="gap-1.5 text-xs">
              <Link2Off className="h-3.5 w-3.5" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connectStrava} disabled={connecting} className="gap-1.5 text-xs bg-[#FC4C02] hover:bg-[#e04402] text-white border-0">
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Connect Strava
            </Button>
          )}
        </div>

        {stravaConnected && (
          <div className="flex items-center gap-3 pt-1 border-t border-border">
            <Button size="sm" variant="outline" onClick={syncStrava} disabled={syncing} className="gap-1.5 text-xs">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {syncing ? "Syncing…" : "Sync Now"}
            </Button>
            {syncResult && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-recovery" />
                {syncResult.synced} new activities synced
              </span>
            )}
          </div>
        )}
      </div>

      {/* Garmin — manual logging */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">⌚</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Garmin Connect</h2>
              <Badge variant="secondary" className="text-xs">Manual</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Garmin's Health API requires an approved partnership — log metrics manually below</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/40 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
          <span>Garmin doesn't offer a public API. You can manually log your HRV, sleep, and body battery on the <strong className="text-foreground">Log Metrics</strong> page — or export a CSV from Garmin Connect and we can import it in the future.</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => window.location.href = '/log'}>
          <Upload className="h-3.5 w-3.5" /> Log Metrics Manually
        </Button>
      </div>

      {/* Apple Health */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center text-2xl">❤️</div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Apple Health</h2>
              <Badge variant="secondary" className="text-xs">Manual</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Apple Health is only accessible from native iOS apps</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/40 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
          <span>Apple Health data (HRV, resting HR, sleep, SpO2) can only be read by native iOS apps. Log these manually on the <strong className="text-foreground">Log Metrics</strong> page to keep your readiness scores accurate.</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => window.location.href = '/log'}>
          <Upload className="h-3.5 w-3.5" /> Log Metrics Manually
        </Button>
      </div>
    </div>
  );
}