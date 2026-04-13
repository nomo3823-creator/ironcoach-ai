import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AppleHealthImport from "./AppleHealthImport";
import moment from "moment";

export default function AppleHealthSettings() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandImport, setExpandImport] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    base44.entities.AthleteProfile.filter({ created_by: currentUser.email })
      .then(data => setProfile(data[0] || null));
  }, [currentUser]);

  async function handleImported() {
    // Debounce: wait 1.5s for backend to settle after bulk import
    await new Promise(resolve => setTimeout(resolve, 1500));
    try {
      const data = await base44.entities.AthleteProfile.filter({ created_by: currentUser.email });
      setProfile(data[0] || null);
    } catch (err) {
      // Silent retry after rate limit cooldown
      await new Promise(resolve => setTimeout(resolve, 2000));
      const data = await base44.entities.AthleteProfile.filter({ created_by: currentUser.email });
      setProfile(data[0] || null);
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
    </div>
  );
}