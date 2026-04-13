import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, AlertCircle, Stethoscope } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AppleHealthImport from "./AppleHealthImport";
import moment from "moment";

export default function AppleHealthSettings() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandImport, setExpandImport] = useState(false);
  const [diag, setDiag] = useState(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const METRIC_FIELDS = [
    "hrv", "resting_hr", "sleep_hours", "sleep_quality", "sleep_deep_minutes",
    "sleep_rem_minutes", "sleep_awake_minutes", "spo2", "body_battery",
    "active_calories", "respiratory_rate", "vo2_max", "weight_kg",
    "readiness_score", "ctl", "atl", "tsb",
  ];
  const MANUAL_FIELDS = [
    "notes", "injury_flag", "illness_flag", "mood",
    "morning_checkin_complete", "energy_level", "legs_feeling",
  ];

  function hasRealValue(v) {
    return v !== null && v !== undefined && v !== "" && !(typeof v === "boolean" && v === false) && !(typeof v === "number" && v === 0);
  }

  function rowIsSkeleton(row) {
    return !METRIC_FIELDS.some(f => hasRealValue(row[f])) &&
           !MANUAL_FIELDS.some(f => hasRealValue(row[f]));
  }

  function countPopulatedFields(row) {
    return METRIC_FIELDS.filter(f => hasRealValue(row[f])).length +
           MANUAL_FIELDS.filter(f => hasRealValue(row[f])).length;
  }

  async function runCleanup() {
    if (!window.confirm("Delete all empty rows and merge duplicates? This cannot be undone.")) return;
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const all = await base44.entities.DailyMetrics.filter(
        { created_by: currentUser.email },
        "-date",
        10000
      );

      // 1. Find skeleton rows to delete outright.
      const skeletons = (all || []).filter(rowIsSkeleton);

      // 2. Group by date; for any date with >1 row, keep the one with the most
      //    populated fields, delete the rest.
      const byDate = new Map();
      for (const r of all || []) {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date).push(r);
      }
      const duplicatesToDelete = [];
      for (const [, rows] of byDate) {
        if (rows.length < 2) continue;
        rows.sort((a, b) => countPopulatedFields(b) - countPopulatedFields(a));
        duplicatesToDelete.push(...rows.slice(1));
      }

      // Dedupe ids across the two lists
      const idsToDelete = new Set([
        ...skeletons.map(r => r.id),
        ...duplicatesToDelete.map(r => r.id),
      ]);

      let deleted = 0;
      for (const id of idsToDelete) {
        try {
          await base44.entities.DailyMetrics.delete(id);
          deleted++;
        } catch {}
      }

      setCleanupResult({
        scanned: all?.length ?? 0,
        skeletons: skeletons.length,
        duplicates: duplicatesToDelete.length,
        deleted,
      });
    } catch (err) {
      setCleanupResult({ error: err?.message || "Cleanup failed" });
    } finally {
      setCleanupLoading(false);
    }
  }

  async function runDiagnostic() {
    setDiagLoading(true);
    setDiag(null);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      // NOTE: Base44 filter(...)'s third arg is a LIMIT — omit it to get the true
      // row count. Use a large limit (10000) so we see actual totals.
      const [scoped, unscoped, todayOnly, activities] = await Promise.all([
        base44.entities.DailyMetrics.filter({ created_by: currentUser.email }, "-date", 10000),
        base44.entities.DailyMetrics.list("-date", 10000),
        base44.entities.DailyMetrics.filter({ date: today, created_by: currentUser.email }),
        base44.entities.Activity.filter({ created_by: currentUser.email, source: "apple_health" }, "-date", 10000),
      ]);

      // Analyse payload quality — how many rows have real HRV / sleep / RHR values?
      const rowsWithHrv = (scoped || []).filter(r => r.hrv > 0).length;
      const rowsWithSleep = (scoped || []).filter(r => r.sleep_hours > 0).length;
      const rowsWithRhr = (scoped || []).filter(r => r.resting_hr > 0).length;
      const rowsWithAnyValue = (scoped || []).filter(r =>
        r.hrv > 0 || r.sleep_hours > 0 || r.resting_hr > 0 || r.spo2 > 0 || r.active_calories > 0
      ).length;

      setDiag({
        currentUserEmail: currentUser.email,
        today,
        scopedCount: scoped?.length ?? 0,
        unscopedCount: unscoped?.length ?? 0,
        todayMatches: todayOnly?.length ?? 0,
        appleHealthWorkouts: activities?.length ?? 0,
        rowsWithHrv,
        rowsWithSleep,
        rowsWithRhr,
        rowsWithAnyValue,
        todayRow: todayOnly?.[0] || null,
        scopedSample: (scoped || []).slice(0, 3).map(r => ({
          date: r.date,
          hrv: r.hrv,
          sleep_hours: r.sleep_hours,
          resting_hr: r.resting_hr,
          spo2: r.spo2,
          active_calories: r.active_calories,
          created_by: r.created_by,
          import_source: r.import_source,
        })),
      });
    } catch (err) {
      setDiag({ error: err?.message || "Diagnostic failed" });
    } finally {
      setDiagLoading(false);
    }
  }

  useEffect(() => {
    if (!currentUser) return;
    base44.entities.AthleteProfile.filter({ created_by: currentUser.email })
      .then(data => setProfile(data[0] || null));
  }, [currentUser]);

  async function handleImported() {
    // Wait for backend to settle after bulk import—rate limits apply
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let retries = 3;
    while (retries > 0) {
      try {
        const data = await base44.entities.AthleteProfile.filter({ created_by: currentUser.email });
        setProfile(data[0] || null);
        return;
      } catch (err) {
        retries--;
        if (retries > 0) {
          // Exponential backoff: 3s, 5s, 8s
          const delay = 3000 + (3 - retries) * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  const lastImport = profile?.last_apple_health_import_date ? moment(profile.last_apple_health_import_date).format('MMM D, YYYY [at] h:mm A') : null;
  const healthDataCount = profile?.apple_health_days_imported || 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-destructive/10 flex items-center justify-center text-2xl">❤️</div>
          <div>
            <h2 className="font-semibold text-foreground">Apple Health</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Import HRV, sleep, SpO2, resting HR, workouts & more</p>
          </div>
        </div>

        {profile?.last_apple_health_import_date ? (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last import:</span>
                <span className="font-medium text-foreground">{lastImport}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Days of data:</span>
                <span className="font-medium text-foreground">{healthDataCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data sources:</span>
                <div className="flex gap-1">
                  <Badge variant="secondary" className="text-xs">HRV</Badge>
                  <Badge variant="secondary" className="text-xs">Sleep</Badge>
                  <Badge variant="secondary" className="text-xs">HR</Badge>
                  <Badge variant="secondary" className="text-xs">SpO2</Badge>
                </div>
              </div>
            </div>
            
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full gap-2 text-xs" 
              onClick={() => setExpandImport(!expandImport)}
            >
              <RefreshCw className="h-3.5 w-3.5" /> {expandImport ? 'Hide' : 'Re-import New Data'}
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
            <span>No Apple Health data imported yet. Start your first import below.</span>
          </div>
        )}

        {expandImport && (
          <div className="pt-4 border-t border-border">
            <AppleHealthImport onImported={handleImported} />
          </div>
        )}

        {!profile?.last_apple_health_import_date && (
          <div>
            <AppleHealthImport onImported={handleImported} />
          </div>
        )}
      </div>

      <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-lg text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent" />
        <span>
          Apple Health data automatically feeds into your <strong className="text-foreground">readiness score, workout recommendations,</strong> and <strong className="text-foreground">recovery analytics.</strong> No manual logging needed.
        </span>
      </div>

      {/* Diagnostic — helps figure out why imported data isn't rendering */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Stethoscope className="h-4 w-4 text-accent mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-foreground">Data diagnostic</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect what's actually in your Base44 DB right now.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runDiagnostic} disabled={diagLoading}>
              {diagLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Run"}
            </Button>
            <Button size="sm" variant="outline" onClick={runCleanup} disabled={cleanupLoading}>
              {cleanupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Clean up"}
            </Button>
          </div>
        </div>

        {cleanupResult && (
          <div className="text-xs rounded-lg bg-secondary/40 p-3 space-y-1 font-mono">
            {cleanupResult.error ? (
              <p className="text-destructive">Error: {cleanupResult.error}</p>
            ) : (
              <>
                <p><span className="text-muted-foreground">scanned:</span> <strong className="text-foreground">{cleanupResult.scanned}</strong> rows</p>
                <p><span className="text-muted-foreground">skeleton rows:</span> <strong className="text-foreground">{cleanupResult.skeletons}</strong></p>
                <p><span className="text-muted-foreground">duplicate rows:</span> <strong className="text-foreground">{cleanupResult.duplicates}</strong></p>
                <p><span className="text-muted-foreground">deleted:</span> <strong className="text-recovery">{cleanupResult.deleted}</strong></p>
              </>
            )}
          </div>
        )}

        {diag && (
          <div className="space-y-2 text-xs">
            {diag.error ? (
              <p className="text-destructive">Error: {diag.error}</p>
            ) : (
              <>
                <div className="rounded-lg bg-secondary/40 p-3 space-y-1 font-mono">
                  <p><span className="text-muted-foreground">user email:</span> {diag.currentUserEmail}</p>
                  <p><span className="text-muted-foreground">today (local):</span> {diag.today}</p>
                  <p><span className="text-muted-foreground">rows owned by you:</span> <strong className="text-foreground">{diag.scopedCount}</strong></p>
                  <p><span className="text-muted-foreground">rows total (any owner):</span> <strong className="text-foreground">{diag.unscopedCount}</strong></p>
                  <p><span className="text-muted-foreground">rows dated today:</span> <strong className="text-foreground">{diag.todayMatches}</strong></p>
                  <p><span className="text-muted-foreground">apple health workouts:</span> <strong className="text-foreground">{diag.appleHealthWorkouts}</strong></p>
                  <p className="pt-2 border-t border-border/50 mt-2"><span className="text-muted-foreground">rows with HRV:</span> <strong className="text-foreground">{diag.rowsWithHrv}</strong></p>
                  <p><span className="text-muted-foreground">rows with sleep:</span> <strong className="text-foreground">{diag.rowsWithSleep}</strong></p>
                  <p><span className="text-muted-foreground">rows with resting HR:</span> <strong className="text-foreground">{diag.rowsWithRhr}</strong></p>
                  <p><span className="text-muted-foreground">rows with any metric value:</span> <strong className="text-foreground">{diag.rowsWithAnyValue}</strong></p>
                </div>

                {diag.todayRow && (
                  <div className="rounded-lg bg-secondary/40 p-3 space-y-1">
                    <p className="font-semibold text-foreground">Today's row (raw):</p>
                    <pre className="text-[10px] overflow-x-auto">{JSON.stringify(diag.todayRow, null, 2)}</pre>
                  </div>
                )}

                {diag.scopedCount > 0 && (
                  <div className="rounded-lg bg-secondary/40 p-3 space-y-1">
                    <p className="font-semibold text-foreground">Your latest rows:</p>
                    <pre className="text-[10px] overflow-x-auto">{JSON.stringify(diag.scopedSample, null, 2)}</pre>
                  </div>
                )}

                {diag.scopedCount === 0 && diag.unscopedCount > 0 && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 space-y-2">
                    <p className="text-destructive font-semibold">Diagnosis: rows exist in the table but none are owned by you.</p>
                    <p className="text-muted-foreground">The imported records have created_by = something other than your email. Sample:</p>
                    <pre className="text-[10px] overflow-x-auto">{JSON.stringify(diag.unscopedSample, null, 2)}</pre>
                  </div>
                )}

                {diag.scopedCount === 0 && diag.unscopedCount === 0 && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3">
                    <p className="text-destructive font-semibold">Diagnosis: DailyMetrics table is empty.</p>
                    <p className="text-muted-foreground mt-1">The import isn't actually saving rows. Open DevTools → Network during a fresh import and watch for 4xx responses from /api/.../DailyMetrics.</p>
                  </div>
                )}

                {diag.scopedCount > 0 && diag.todayMatches === 0 && (
                  <div className="rounded-lg bg-accent/10 border border-accent/30 p-3">
                    <p className="text-accent font-semibold">Diagnosis: data imported, but nothing for today.</p>
                    <p className="text-muted-foreground mt-1">Apple Health exports typically lag by a day. Dashboard/Today show "—" for today because no Apple Health row exists for {diag.today} yet. Analytics and Recovery should still populate from the historical rows.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}