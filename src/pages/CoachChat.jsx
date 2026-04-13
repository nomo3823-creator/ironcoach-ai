import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Loader2, Zap, Plus, MessageSquare,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MessageBubble from "../components/chat/MessageBubble";
import { phaseLabels } from "@/lib/sportUtils";
import { getRaceLabel } from "@/lib/raceTypes";
import { toast } from "sonner";
import moment from "moment";

// ─── Context helpers ──────────────────────────────────────────────────────

async function loadAthleteContext() {
  const today   = moment().format("YYYY-MM-DD");
  const in14    = moment().add(14, "days").format("YYYY-MM-DD");
  const [profiles, metricsArr, workoutsArr, races, allWorkouts] = await Promise.all([
    base44.entities.AthleteProfile.list("-created_date", 1),
    base44.entities.DailyMetrics.filter({ date: today }),
    base44.entities.PlannedWorkout.filter({ date: today }),
    base44.entities.Race.list("date", 5),
    base44.entities.PlannedWorkout.list("date", 60),
  ]);
  const next14Days = (allWorkouts || []).filter(w => w.date >= today && w.date <= in14);
  return {
    profile:   profiles?.[0] || null,
    metrics:   metricsArr?.[0] || null,
    workout:   workoutsArr?.[0] || null,
    races:     races || [],
    next14Days,
  };
}

function buildSystemPrompt(profile, nextRace, next14Days) {
  let rawAnswers = "";
  if (profile?.onboarding_raw_answers) {
    try {
      const parsed = JSON.parse(profile.onboarding_raw_answers);
      rawAnswers = Object.entries(parsed).map(([k, v]) => `  ${k}: ${v}`).join("\n");
    } catch {}
  }
  const currentPhase = next14Days?.[0]?.phase || "base";
  const next14Str = next14Days?.length
    ? next14Days.slice(0, 14).map(w => `  ${w.date}: [${w.sport}] ${w.title} (${w.duration_minutes}min, ${w.intensity})`).join("\n")
    : "  No sessions scheduled yet.";

  return `You are this athlete's personal endurance coach. You know everything about them. Never ask for info you already have. Never give generic advice. Always be specific to their data.

ATHLETE PROFILE:
Name: ${profile?.first_name || "Athlete"}
FTP: ${profile?.current_ftp ? profile.current_ftp + "W" : "unknown"} | Run threshold: ${profile?.threshold_run_pace || "unknown"}/km | CSS: ${profile?.css_per_100m ? profile.css_per_100m + "s/100m" : "unknown"}
Experience: ${profile?.experience_level || "unknown"} | Weekly hours: ${profile?.weekly_hours_available || "unknown"}h
Biggest limiter: ${profile?.biggest_limiter || "unknown"}
Injury history: ${profile?.injury_history || "none reported"}
Motivation: "${profile?.motivation_statement || "not provided"}"
${nextRace ? `Target race: ${nextRace.name} on ${nextRace.date} (${getRaceLabel(nextRace.race_type || nextRace.distance)})` : "No target race set."}
Current training phase: ${phaseLabels[currentPhase] || "Base"}

COACHING NOTES FROM PREVIOUS SESSIONS:
${profile?.extracted_insights || "No notes yet — this is early in your work together."}

ORIGINAL ONBOARDING Q&A:
${rawAnswers || "Not available."}

ATHLETE'S NEXT 14 DAYS:
${next14Str}

YOUR COMMUNICATION RULES — NEVER BREAK THESE:
1. 2–4 sentences max by default. More only if the athlete explicitly asks for detail.
2. No bullet points unless specifically requested.
3. Zero filler: no "Great question!", "Absolutely!", "Of course!", "Happy to help!", "That's a great point!"
4. Never repeat back what the athlete just said.
5. Talk like a coach texting their athlete — direct, warm, real.
6. Always reference their actual numbers when giving advice (FTP, HRV, pace, TSB, etc.).
7. Say problems plainly. Don't soften bad news with fluff.`;
}

function buildContextString(profile, metrics, workout, races, next14Days) {
  const today      = moment().format("YYYY-MM-DD");
  const futureRaces = (races || []).filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextRace   = futureRaces[0];
  const daysToRace = nextRace ? moment(nextRace.date).diff(moment(), "days") : null;

  let rawAnswers = "";
  if (profile?.onboarding_raw_answers) {
    try {
      const parsed = JSON.parse(profile.onboarding_raw_answers);
      rawAnswers = Object.entries(parsed).map(([k, v]) => `  ${k}: ${v}`).join("\n");
    } catch {}
  }

  const next14Str = next14Days?.length
    ? next14Days.slice(0, 14).map(w => `  ${w.date}: [${w.sport}] ${w.title} (${w.duration_minutes}min, ${w.intensity})`).join("\n")
    : "  None scheduled";

  return `[ATHLETE CONTEXT — not visible to user]
Name: ${profile?.first_name || "Athlete"} | FTP: ${profile?.current_ftp ? profile.current_ftp + "W" : "unknown"} | Run threshold: ${profile?.threshold_run_pace || "unknown"}/km | CSS: ${profile?.css_per_100m ? profile.css_per_100m + "s/100m" : "unknown"}
Experience: ${profile?.experience_level || "unknown"} | ${profile?.weekly_hours_available || "unknown"}h/week | Available days: ${profile?.available_training_days || "unknown"}
Limiter: ${profile?.biggest_limiter || "unknown"} | Injury history: ${profile?.injury_history || "none"}
Motivation: "${profile?.motivation_statement || "—"}"
Coaching notes: ${profile?.extracted_insights || "none yet"}
${rawAnswers ? `\nOnboarding answers:\n${rawAnswers}` : ""}
TODAY: HRV ${metrics?.hrv || "—"}ms | Sleep ${metrics?.sleep_hours || "—"}h (${metrics?.sleep_quality || "—"}) | Body Battery ${metrics?.body_battery || "—"} | Readiness ${metrics?.readiness_score || "—"}/100 | TSB ${metrics?.tsb ?? "—"} | Resting HR ${metrics?.resting_hr || "—"}bpm
Today's session: ${workout ? `${workout.title} (${workout.sport}, ${workout.duration_minutes}min, ${workout.intensity})` : "Rest day"}
Next race: ${nextRace ? `${nextRace.name} on ${nextRace.date} (${daysToRace} days, ${getRaceLabel(nextRace.race_type || nextRace.distance)})` : "none scheduled"}
Next 14 days:
${next14Str}`;
}

// ─── Plan Approval Card ───────────────────────────────────────────────────

function PlanApprovalCard({ rec, onApprove, onReject }) {
  const [acting, setActing] = useState(false);
  let changes = [];
  try { changes = JSON.parse(rec.proposed_changes); } catch {}

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 space-y-3 mx-0">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Plan Recommendation</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rec.summary}</p>
        </div>
      </div>

      {changes.length > 0 && (
        <div className="space-y-1.5">
          {changes.map((c, i) => (
            <div key={i} className="text-xs rounded-lg bg-secondary/60 p-2.5">
              <p className="font-medium text-foreground">{c.workout_title}{" "}
                <span className="text-muted-foreground font-normal">({moment(c.workout_date).format("MMM D")})</span>
              </p>
              <p className="text-muted-foreground mt-0.5">
                {c.before_duration}min {c.before_intensity} → {c.after_duration}min <span className="font-medium text-foreground">{c.after_intensity}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 bg-recovery hover:bg-recovery/90 text-white h-8 text-xs"
          disabled={acting}
          onClick={async () => { setActing(true); await onApprove(rec); }}
        >
          {acting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Update My Plan</>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          disabled={acting}
          onClick={() => onReject(rec)}
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />Dismiss
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function CoachChat() {
  const [convs,              setConvs]              = useState([]);
  const [active,             setActive]             = useState(null);
  const [messages,           setMessages]           = useState([]);
  const [input,              setInput]              = useState("");
  const [sending,            setSending]            = useState(false);
  const [loadingConvs,       setLoadingConvs]       = useState(true);
  const [starters,           setStarters]           = useState([]);
  const [loadingStarters,    setLoadingStarters]    = useState(true);
  const [athleteCtx,         setAthleteCtx]         = useState(null);
  const [messageSentCount,   setMessageSentCount]   = useState(0);
  const [pendingRecs,        setPendingRecs]        = useState([]);
  const [quickReplies,       setQuickReplies]       = useState([]);
  const [generatingReplies,  setGeneratingReplies]  = useState(false);
  const scrollRef       = useRef(null);
  const lastMsgCountRef = useRef(0);

  useEffect(() => {
    loadConvs();
    initContext();
    loadPendingRecs();
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────

  async function initContext() {
    setLoadingStarters(true);
    const ctx = await loadAthleteContext();
    setAthleteCtx(ctx);

    const today = moment().format("YYYY-MM-DD");
    const nextRace = ctx.races.filter(r => r.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
    const summary = [
      `FTP: ${ctx.profile?.current_ftp || "?"}W`,
      `limiter: ${ctx.profile?.biggest_limiter || "?"}`,
      `HRV: ${ctx.metrics?.hrv || "—"}ms`,
      `readiness: ${ctx.metrics?.readiness_score || "—"}/100`,
      `today: ${ctx.workout?.title || "rest"}`,
      nextRace ? `race in ${moment(nextRace.date).diff(moment(), "days")} days` : "no race set",
    ].join(", ");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Athlete status: ${summary}.\n\nGenerate 4 ultra-short coach conversation starters (max 7 words each) that are directly relevant to their current situation. Return JSON: { questions: string[] }`,
      response_json_schema: {
        type: "object",
        properties: { questions: { type: "array", items: { type: "string" } } },
      },
    });
    setStarters(result?.questions?.slice(0, 4) || [
      "How am I doing on recovery?",
      "Am I on track for my race?",
      "Should I adjust anything this week?",
      "What should I focus on today?",
    ]);
    setLoadingStarters(false);
  }

  async function loadConvs() {
    const data = await base44.agents.listConversations({ agent_name: "iron_coach" });
    setConvs(data || []);
    setLoadingConvs(false);
  }

  async function loadPendingRecs() {
    try {
      const recs = await base44.entities.PlanRecommendation.list("-created_date", 10);
      setPendingRecs((recs || []).filter(r => r.status === "pending"));
    } catch {
      setPendingRecs([]);
    }
  }

  // ── Conversation management ───────────────────────────────────────────

  async function select(id) {
    const c = await base44.agents.getConversation(id);
    setActive(c);
    setMessages(c.messages || []);
    setQuickReplies([]);
    lastMsgCountRef.current = (c.messages || []).filter(m => m.role !== "system").length;
  }

  async function newConv() {
    const ctx = athleteCtx || await loadAthleteContext();
    if (!athleteCtx) setAthleteCtx(ctx);

    const c = await base44.agents.createConversation({
      agent_name: "iron_coach",
      metadata: { name: `Session ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })}` },
    });
    setConvs(p => [c, ...p]);
    setActive(c);
    setMessages([]);
    setQuickReplies([]);
    lastMsgCountRef.current = 0;

    // Inject silent system prompt so coach always has full athlete context
    const today      = moment().format("YYYY-MM-DD");
    const nextRace   = ctx.races.filter(r => r.date >= today).sort((a,b) => a.date.localeCompare(b.date))[0];
    const systemPrompt = buildSystemPrompt(ctx.profile, nextRace, ctx.next14Days);
    try {
      await base44.agents.addMessage(c, { role: "system", content: systemPrompt });
    } catch {}

    return c;
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!active?.id) return;
    const unsub = base44.agents.subscribeToConversation(active.id, (d) => {
      const msgs    = d.messages || [];
      const visible = msgs.filter(m => m.role !== "system");
      setMessages(msgs);

      // Generate quick replies when a new completed assistant message arrives
      if (visible.length > lastMsgCountRef.current) {
        lastMsgCountRef.current = visible.length;
        const last = visible[visible.length - 1];
        const allToolsDone = !last?.tool_calls?.some(
          tc => tc.status === "running" || tc.status === "pending" || tc.status === "in_progress"
        );
        if (last?.role === "assistant" && last?.content && allToolsDone) {
          generateQuickReplies(last.content);
        }
      }
    });
    return unsub;
  }, [active?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, quickReplies, pendingRecs]);

  // ── Quick replies ─────────────────────────────────────────────────────

  async function generateQuickReplies(lastMsg) {
    setGeneratingReplies(true);
    setQuickReplies([]);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Coach just said: "${lastMsg.substring(0, 400)}"\n\nGenerate 3 very short natural athlete follow-up replies (max 6 words each). Return JSON: { replies: string[] }`,
        response_json_schema: {
          type: "object",
          properties: { replies: { type: "array", items: { type: "string" } } },
        },
      });
      setQuickReplies((res?.replies || []).slice(0, 3));
    } catch {}
    setGeneratingReplies(false);
  }

  // ── Sending messages ──────────────────────────────────────────────────

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");
    setQuickReplies([]);

    let conv = active;
    if (!conv) {
      conv = await newConv();
    }

    // Always load fresh context so every message has current data
    const ctx = await loadAthleteContext();
    setAthleteCtx(ctx);
    const contextStr = buildContextString(ctx.profile, ctx.metrics, ctx.workout, ctx.races, ctx.next14Days);

    await base44.agents.addMessage(conv, {
      role:    "user",
      content: `${contextStr}\n\nAthlete: ${msg}`,
    });

    setSending(false);
    const newCount = messageSentCount + 1;
    setMessageSentCount(newCount);
    extractInsightsInBackground(msg, conv, newCount, ctx);
  }

  // ── Background insight extraction & signal detection ─────────────────

  async function extractInsightsInBackground(userMessage, conv, sentCount, ctx) {
    const lm = userMessage.toLowerCase();

    const injuryKw    = ["pain","hurt","sore","knee","hamstring","shoulder","ankle","hip","injury","injured","strain","sprain"];
    const fatigueKw   = ["exhausted","burnt out","burned out","tired","struggling","overwhelmed","fatigue","drained","crash","overtraining"];
    const disruptKw   = ["sick","ill","travel","missed","stress","family","work conflict","not training","skipped"];

    const hasInjury   = injuryKw.some(k => lm.includes(k));
    const hasFatigue  = fatigueKw.some(k => lm.includes(k));
    const hasDisrupt  = disruptKw.some(k => lm.includes(k));
    const hasSignal   = hasInjury || hasFatigue || hasDisrupt;

    if (hasSignal) {
      // Update athlete insights
      const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
      if (profiles?.[0]) {
        const existing = profiles[0].extracted_insights || "";
        const updated  = await base44.integrations.Core.InvokeLLM({
          prompt: `Athlete said: "${userMessage}"\nExisting insights: ${existing}\nAdd any new health/injury/fatigue signal (1–2 sentences, only if genuinely new). Return complete updated insights string.`,
        });
        if (updated) await base44.entities.AthleteProfile.update(profiles[0].id, { extracted_insights: updated });
      }

      // Build proposed changes WITHOUT applying them
      const today    = moment().format("YYYY-MM-DD");
      const upcoming = await base44.entities.PlannedWorkout.list("date", 20);
      const future   = (upcoming || []).filter(w => w.date >= today && w.status === "planned");
      const proposed = [];

      if (hasInjury) {
        const signal = injuryKw.find(k => lm.includes(k)) || "injury";
        const target = future
          .filter(w => w.intensity === "hard" || w.intensity === "race_pace" || (w.sport === "run" && hasInjury))
          .slice(0, 3);
        for (const w of target) {
          const newDur = Math.round((w.duration_minutes || 60) * 0.7);
          proposed.push({
            workout_id:      w.id,
            workout_title:   w.title,
            workout_date:    w.date,
            before_intensity: w.intensity,
            before_duration:  w.duration_minutes,
            after_intensity:  "easy",
            after_duration:   newDur,
            reason:          `Injury signal (${signal}) mentioned in chat on ${today}`,
            change_type:     "injury_flag",
          });
        }
      } else {
        const horizon = moment().add(3, "days").format("YYYY-MM-DD");
        const target  = future.filter(w => w.date <= horizon && w.intensity !== "recovery").slice(0, 2);
        for (const w of target) {
          const newDur = Math.round((w.duration_minutes || 60) * 0.7);
          proposed.push({
            workout_id:      w.id,
            workout_title:   w.title,
            workout_date:    w.date,
            before_intensity: w.intensity,
            before_duration:  w.duration_minutes,
            after_intensity:  "recovery",
            after_duration:   newDur,
            reason:          `${hasFatigue ? "Fatigue" : "Life disruption"} signal in chat on ${today}`,
            change_type:     "chat_conversation",
          });
        }
      }

      if (proposed.length > 0) {
        const signalLabel = hasInjury ? "injury" : hasFatigue ? "fatigue" : "disruption";
        const summary     = `Based on ${signalLabel} mentioned in chat: reduce load on ${proposed.length} upcoming session${proposed.length > 1 ? "s" : ""}.`;

        // Create a pending approval record
        let recCreated = false;
        try {
          const rec = await base44.entities.PlanRecommendation.create({
            recommendation_type: hasInjury ? "injury_flag" : "chat_conversation",
            summary,
            signal_description:  `${signalLabel} mentioned: "${userMessage.substring(0, 150)}"`,
            proposed_changes:    JSON.stringify(proposed),
            status:              "pending",
            conversation_id:     conv.id,
          });
          setPendingRecs(prev => [...prev, rec]);
          recCreated = true;
        } catch {
          // PlanRecommendation entity not set up yet — fall back to direct change with toast
        }

        // Post assistant message (always)
        const changeLines = proposed
          .map(c => `• ${c.workout_title} (${moment(c.workout_date).format("MMM D")}): ${c.before_duration}min ${c.before_intensity} → ${c.after_duration}min ${c.after_intensity}`)
          .join("\n");
        await base44.agents.addMessage(conv, {
          role:    "assistant",
          content: `Based on what you mentioned, I recommend adjusting ${proposed.length} upcoming session${proposed.length > 1 ? "s" : ""}:\n\n${changeLines}\n\n${recCreated ? "Approve or dismiss the change below." : "These changes have been applied."}`,
        });

        if (!recCreated) {
          for (const c of proposed) {
            await base44.entities.PlannedWorkout.update(c.workout_id, {
              intensity:           c.after_intensity,
              duration_minutes:    c.after_duration,
              ai_adjustment_reason:c.reason,
              status:              "modified",
            });
          }
          toast(`Plan adjusted — ${signalLabel} detected`, { description: `${proposed.length} session${proposed.length > 1 ? "s" : ""} reduced.` });
        }
      }
    }

    // Every 5 messages: extract general coaching insights
    if (sentCount % 5 === 0) {
      try {
        const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
        if (!profiles?.[0]) return;
        const convData = await base44.agents.getConversation(conv.id);
        const recentMsgs = (convData.messages || [])
          .filter(m => m.role !== "system")
          .slice(-10)
          .map(m => `${m.role}: ${typeof m.content === "string" ? m.content.substring(0, 300) : ""}`)
          .join("\n");
        const existing = profiles[0].extracted_insights || "";
        const updated  = await base44.integrations.Core.InvokeLLM({
          prompt: `Review this coach-athlete conversation and extract any NEW durable coaching insights:\n\n${recentMsgs}\n\nExisting notes: ${existing || "None"}\n\nOnly add genuinely new info: preferences, patterns, mental state, training response, lifestyle. If nothing new, return existing unchanged. 2–5 sentences max. Return complete updated string.`,
        });
        if (updated && updated !== existing) {
          await base44.entities.AthleteProfile.update(profiles[0].id, { extracted_insights: updated });
        }
      } catch {}
    }
  }

  // ── Approve / Reject handlers ─────────────────────────────────────────

  async function approveRec(rec) {
    let changes = [];
    try { changes = JSON.parse(rec.proposed_changes); } catch {}

    for (const c of changes) {
      await base44.entities.PlannedWorkout.update(c.workout_id, {
        intensity:           c.after_intensity,
        duration_minutes:    c.after_duration,
        ai_adjustment_reason:c.reason,
        status:              "modified",
      });
      await base44.entities.PlanChangeLog.create({
        workout_id:        c.workout_id,
        workout_date:      c.workout_date,
        change_type:       c.change_type,
        change_summary:    `${c.workout_title}: ${c.before_intensity} → ${c.after_intensity}`,
        reason:            c.reason,
        before_title:      c.workout_title,
        before_duration:   c.before_duration,
        before_intensity:  c.before_intensity,
        after_title:       c.workout_title,
        after_duration:    c.after_duration,
        after_intensity:   c.after_intensity,
        signal_value:      rec.signal_description,
      });
    }

    await base44.entities.PlanRecommendation.update(rec.id, { status: "approved" });
    setPendingRecs(prev => prev.filter(r => r.id !== rec.id));

    if (active) {
      await base44.agents.addMessage(active, {
        role:    "assistant",
        content: `Done — ${changes.length} session${changes.length > 1 ? "s" : ""} updated in your plan. Train smart.`,
      });
    }
    toast.success("Plan updated", { description: `${changes.length} session${changes.length > 1 ? "s" : ""} adjusted.` });
  }

  async function rejectRec(rec) {
    try {
      await base44.entities.PlanRecommendation.update(rec.id, { status: "rejected" });
    } catch {}
    setPendingRecs(prev => prev.filter(r => r.id !== rec.id));
    if (active) {
      await base44.agents.addMessage(active, {
        role:    "assistant",
        content: "Keeping your plan as-is. Let me know if anything changes.",
      });
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────

  const visibleMessages  = messages.filter(m => m.role !== "system");
  const relevantRecs     = active
    ? pendingRecs.filter(r => r.conversation_id === active.id)
    : pendingRecs;

  return (
    <div className="flex h-full">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/30 shrink-0">
        <div className="p-3 border-b border-border">
          <Button onClick={() => newConv()} variant="outline" size="sm" className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingConvs ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : convs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No sessions yet</p>
          ) : convs.map(c => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate",
                active?.id === c.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 inline mr-2 opacity-60" />
              {c.metadata?.name || "Chat"}
            </button>
          ))}
        </div>

        {/* Pending recs badge */}
        {pendingRecs.length > 0 && (
          <div className="mx-3 mb-3 p-2.5 rounded-lg border border-accent/30 bg-accent/5">
            <p className="text-xs font-medium text-accent">{pendingRecs.length} pending recommendation{pendingRecs.length > 1 ? "s" : ""}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Open the relevant chat to approve</p>
          </div>
        )}
      </aside>

      {/* ── Main Chat ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 shrink-0">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Coach Chat</h2>
            <p className="text-sm text-muted-foreground max-w-xs mt-2 mb-6">
              Direct, data-driven coaching. Full context in every response.
            </p>

            {/* Pending recs on empty state */}
            {pendingRecs.length > 0 && (
              <div className="w-full max-w-lg mb-5 space-y-3 text-left">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending Recommendations</p>
                {pendingRecs.slice(0, 3).map(rec => (
                  <PlanApprovalCard key={rec.id} rec={rec} onApprove={approveRec} onReject={rejectRec} />
                ))}
              </div>
            )}

            {/* Starter chips */}
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg w-full mb-6">
              {loadingStarters ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl border border-border bg-card animate-pulse" />
              )) : starters.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="p-3 rounded-xl border border-border bg-card text-sm text-left text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <Button onClick={() => newConv()}>
              <Plus className="h-4 w-4 mr-2" /> Start Session
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-card/50 flex items-center gap-3 shrink-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {active.metadata?.name || "Coach Chat"}
                </p>
                <p className="text-[11px] text-muted-foreground">Full context · {visibleMessages.length} messages</p>
              </div>
              {relevantRecs.length > 0 && (
                <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full font-medium shrink-0">
                  {relevantRecs.length} pending
                </span>
              )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {visibleMessages.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    I have your full profile, today's data, and your next 14 days loaded. Start talking.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {starters.map(q => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {visibleMessages.map((m, i) => <MessageBubble key={i} message={m} />)}

              {/* Plan approval cards inline */}
              {relevantRecs.map(rec => (
                <PlanApprovalCard key={rec.id} rec={rec} onApprove={approveRec} onReject={rejectRec} />
              ))}
            </div>

            {/* Quick reply chips */}
            {(quickReplies.length > 0 || generatingReplies) && !sending && (
              <div className="px-4 py-2.5 border-t border-border/50 flex flex-wrap gap-2 shrink-0 bg-card/30">
                {generatingReplies ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 w-24 rounded-full bg-secondary animate-pulse" />
                )) : quickReplies.map(r => (
                  <button
                    key={r}
                    onClick={() => { setQuickReplies([]); send(r); }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors whitespace-nowrap"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={e => { e.preventDefault(); send(); }}
              className="p-3 sm:p-4 border-t border-border bg-card/50 shrink-0"
            >
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask your coach anything…"
                  disabled={sending}
                  className="flex-1 bg-secondary/50 text-sm"
                />
                <Button type="submit" disabled={sending || !input.trim()} size="icon" className="shrink-0">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
