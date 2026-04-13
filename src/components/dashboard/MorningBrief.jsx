import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronDown, ChevronUp, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

export default function MorningBrief({ metrics, workout, profile }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function generate() {
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are IronCoach AI, an elite Ironman triathlon coach. Write a personalized morning brief in 3-4 sentences.

Athlete: ${profile?.full_name || "Athlete"} | FTP: ${profile?.current_ftp || "?"}W | VO2max: ${profile?.vo2_max || "?"}
Today's HRV: ${metrics?.hrv || "?"}ms | Resting HR: ${metrics?.resting_hr || "?"}bpm
Sleep: ${metrics?.sleep_hours || "?"}h (${metrics?.sleep_quality || "?"} quality) | Body Battery: ${metrics?.body_battery || "?"}/100
Readiness: ${metrics?.readiness_score || "?"}/100 | Mood: ${metrics?.mood || "?"}
CTL: ${metrics?.ctl || "?"} | ATL: ${metrics?.atl || "?"} | TSB: ${metrics?.tsb || "?"}
Injury: ${metrics?.injury_flag ? "YES" : "No"} | Illness: ${metrics?.illness_flag ? "YES" : "No"}
Today's workout: ${workout ? `${workout.title} (${workout.sport}, ${workout.duration_minutes}min, ${workout.intensity})` : "Rest day"}

Be direct, reference specific numbers, give actionable advice. If recovery is low, recommend adjustment. End with motivation.`,
    });
    setBrief(result);
    setLoading(false);
    setExpanded(true);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => { if (!brief && !loading) generate(); else setExpanded(!expanded); }}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">AI Morning Brief</p>
            <p className="text-xs text-muted-foreground">{brief ? "Personalized coaching insight" : "Generate today's brief"}</p>
          </div>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> :
          expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> :
          <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && brief && (
        <div className="px-4 pb-4 space-y-2">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <ReactMarkdown className="text-sm text-foreground/90 leading-relaxed prose prose-sm max-w-none [&_p]:text-foreground/90 [&_strong]:text-foreground">
              {brief}
            </ReactMarkdown>
          </div>
          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground h-7" onClick={(e) => { e.stopPropagation(); setBrief(null); generate(); }}>
            <RefreshCw className="h-3 w-3 mr-1" /> Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}