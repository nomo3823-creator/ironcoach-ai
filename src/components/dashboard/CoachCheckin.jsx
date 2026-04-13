import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Zap, Loader2, ChevronDown, ChevronUp, X, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import moment from "moment";

export default function CoachCheckin({ profile, metrics, workout }) {
  const [checkin, setCheckin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const today = moment().format("YYYY-MM-DD");

  useEffect(() => {
    // Check if we already have a morning checkin stored for today
    if (profile?.last_morning_checkin === today) {
      // Already done today — don't regenerate
      return;
    }
    // Auto-generate on mount only if metrics exist
    if (metrics) generate();
  }, [profile?.id, metrics?.date]);

  async function generate() {
    setLoading(true);

    // Get recent chat context
    const convs = await base44.agents.listConversations({ agent_name: "iron_coach" });
    let recentContext = "";
    if (convs?.[0]) {
      const conv = await base44.agents.getConversation(convs[0].id);
      const lastMsgs = (conv.messages || []).slice(-6);
      recentContext = lastMsgs.map((m) => `${m.role}: ${m.content}`).join("\n");
    }

    const prompt = `You are IronCoach AI. Write a personalized morning check-in for this athlete. Be direct, reference specific numbers, never be generic. Max 4 sentences.

Athlete: ${profile?.first_name || profile?.full_name || "Athlete"}
Motivation: "${profile?.motivation_statement || "completing their Ironman"}"
Today's HRV: ${metrics?.hrv || "?"}ms | Resting HR: ${metrics?.resting_hr || "?"}bpm
Sleep: ${metrics?.sleep_hours || "?"}h (${metrics?.sleep_quality || "?"}) | Body Battery: ${metrics?.body_battery || "?"}/100
Readiness: ${metrics?.readiness_score || "?"}/100 | TSB: ${metrics?.tsb || "?"}
Today's workout: ${workout ? `${workout.title} (${workout.sport}, ${workout.duration_minutes}min, ${workout.intensity})` : "Rest day"}
Injury flag: ${metrics?.injury_flag ? "YES" : "No"} | Illness: ${metrics?.illness_flag ? "YES" : "No"}

Recent chat context:
${recentContext || "No recent conversations."}

Reference a specific number, make an adjustment recommendation if needed, and tie it to their motivation.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setCheckin(result);

    // Mark today as done in profile
    if (profile?.id) {
      await base44.entities.AthleteProfile.update(profile.id, { last_morning_checkin: today });
    }

    setLoading(false);
  }

  if (dismissed) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Morning Check-in</p>
            <p className="text-xs text-muted-foreground">{moment().format("dddd, MMMM D")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button onClick={() => setDismissed(true)} className="p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating your morning brief…
            </div>
          ) : checkin ? (
            <ReactMarkdown className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none [&_p]:text-foreground [&_p]:my-0.5 [&_strong]:text-primary">
              {checkin}
            </ReactMarkdown>
          ) : !metrics ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>Log today's metrics to get your personalized check-in. <Link to="/log" className="text-primary underline underline-offset-2">Log now →</Link></span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}