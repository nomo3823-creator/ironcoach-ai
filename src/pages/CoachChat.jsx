import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Zap, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import MessageBubble from "../components/chat/MessageBubble";
import moment from "moment";

function buildContextString(profile, metrics, workout, races, userName) {
  const today = moment().format("YYYY-MM-DD");
  const futureRaces = (races || []).filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const nextRace = futureRaces[0];
  const daysToRace = nextRace ? moment(nextRace.date).diff(moment(), "days") : null;

  let rawAnswers = "";
  if (profile?.onboarding_raw_answers) {
    try {
      const parsed = JSON.parse(profile.onboarding_raw_answers);
      rawAnswers = Object.entries(parsed).map(([k, v]) => `  ${k}: ${v}`).join("\n");
    } catch {}
  }

  return `ATHLETE CONTEXT (not visible to user):
Name: ${userName || profile?.first_name || "Athlete"}
FTP: ${profile?.current_ftp ? `${profile.current_ftp}W` : "unknown"}
Run threshold: ${profile?.threshold_run_pace || "unknown"}/km
CSS: ${profile?.css_per_100m ? `${profile.css_per_100m}s/100m` : "unknown"}
Experience level: ${profile?.experience_level || "unknown"}
Weekly hours available: ${profile?.weekly_hours_available || "unknown"}h
Available training days: ${profile?.available_training_days || "unknown"}
Biggest limiter: ${profile?.biggest_limiter || "unknown"}
Injury history: ${profile?.injury_history || "none reported"}
Motivation: ${profile?.motivation_statement || "not provided"}
Coaching insights from past conversations: ${profile?.extracted_insights || "none yet"}
${rawAnswers ? `\nFull onboarding answers:\n${rawAnswers}` : ""}
Today's metrics: HRV ${metrics?.hrv || "—"}ms, Sleep ${metrics?.sleep_hours || "—"}h (${metrics?.sleep_quality || "—"}), Body Battery ${metrics?.body_battery || "—"}, Readiness ${metrics?.readiness_score || "—"}/100, Resting HR ${metrics?.resting_hr || "—"}bpm, TSB ${metrics?.tsb ?? "—"}
Today's workout: ${workout ? `${workout.title} — ${workout.description || ""} (${workout.duration_minutes}min, ${workout.intensity})` : "Rest day"}
Next race: ${nextRace ? `${nextRace.name} on ${nextRace.date} (${daysToRace} days away, ${nextRace.distance === "140.6" ? "Full Ironman" : "Ironman 70.3"})` : "none scheduled"}`;
}

async function loadAthleteContext() {
  const today = moment().format("YYYY-MM-DD");
  const [profiles, metricsArr, workoutsArr, races] = await Promise.all([
    base44.entities.AthleteProfile.list("-created_date", 1),
    base44.entities.DailyMetrics.filter({ date: today }),
    base44.entities.PlannedWorkout.filter({ date: today }),
    base44.entities.Race.list("date", 5),
  ]);
  return {
    profile: profiles?.[0] || null,
    metrics: metricsArr?.[0] || null,
    workout: workoutsArr?.[0] || null,
    races: races || [],
  };
}

export default function CoachChat() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [starters, setStarters] = useState([]);
  const [loadingStarters, setLoadingStarters] = useState(true);
  const [athleteCtx, setAthleteCtx] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadConvs();
    initContext();
  }, []);

  async function initContext() {
    setLoadingStarters(true);
    const ctx = await loadAthleteContext();
    setAthleteCtx(ctx);

    const profileSummary = `FTP: ${ctx.profile?.current_ftp || "unknown"}W, limiter: ${ctx.profile?.biggest_limiter || "unknown"}, HRV: ${ctx.metrics?.hrv || "—"}ms, readiness: ${ctx.metrics?.readiness_score || "—"}/100, today's workout: ${ctx.workout?.title || "rest"}, days to next race: ${ctx.races?.filter(r => r.date >= moment().format("YYYY-MM-DD")).sort((a,b) => a.date.localeCompare(b.date))[0] ? moment(ctx.races.filter(r => r.date >= moment().format("YYYY-MM-DD")).sort((a,b) => a.date.localeCompare(b.date))[0].date).diff(moment(), "days") + " days" : "no race scheduled"}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Given this athlete's current state: ${profileSummary}, generate 4 short natural coach conversation starter questions (max 10 words each) that are directly relevant to their situation right now. Return as a JSON array of strings.`,
      response_json_schema: { type: "object", properties: { questions: { type: "array", items: { type: "string" } } } },
    });
    setStarters(result?.questions || [
      "Should I do my long run tomorrow or rest?",
      "What's my biggest weakness right now?",
      "How's my taper going?",
      "Analyze my recent training load",
    ]);
    setLoadingStarters(false);
  }

  async function loadConvs() {
    const data = await base44.agents.listConversations({ agent_name: "iron_coach" });
    setConvs(data || []);
    setLoadingConvs(false);
  }

  async function select(id) {
    const c = await base44.agents.getConversation(id);
    setActive(c);
    setMessages(c.messages || []);
  }

  async function newConv(userName) {
    const ctx = athleteCtx || await loadAthleteContext();
    if (!athleteCtx) setAthleteCtx(ctx);

    const c = await base44.agents.createConversation({
      agent_name: "iron_coach",
      metadata: { name: `Session ${new Date().toLocaleDateString("en", { month: "short", day: "numeric" })}` },
    });
    setConvs((p) => [c, ...p]);
    setActive(c);
    setMessages([]);

    // Inject full athlete context as system message so every new session starts with full memory
    const contextMsg = buildContextString(ctx.profile, ctx.metrics, ctx.workout, ctx.races, userName);
    await base44.agents.addMessage(c, { role: "system", content: contextMsg });

    return c;
  }

  useEffect(() => {
    if (!active?.id) return;
    const unsub = base44.agents.subscribeToConversation(active.id, (d) => setMessages(d.messages || []));
    return unsub;
  }, [active?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setSending(true);
    setInput("");

    let conv = active;
    if (!conv) {
      conv = await newConv();
    }

    // Load full athlete context and inject as system message before every user message
    const ctx = athleteCtx || await loadAthleteContext();
    const contextStr = buildContextString(ctx.profile, ctx.metrics, ctx.workout, ctx.races);
    await base44.agents.addMessage(conv, { role: "system", content: contextStr });
    await base44.agents.addMessage(conv, { role: "user", content: msg });

    setSending(false);

    // Background: extract insights and trigger plan modifications if needed
    extractInsightsInBackground(msg, conv);
  }

  async function extractInsightsInBackground(userMessage, conv) {
    const lm = userMessage.toLowerCase();
    const injuryKeywords = ["pain", "hurt", "sore", "knee", "hamstring", "shoulder", "ankle", "injury"];
    const fatigueKeywords = ["exhausted", "burnt out", "tired", "struggling", "overwhelmed", "burned out"];
    const hasInjury = injuryKeywords.some((k) => lm.includes(k));
    const hasFatigue = fatigueKeywords.some((k) => lm.includes(k));
    const hasAnySignal = hasInjury || hasFatigue || ["sick", "fatigue", "stress", "missed"].some(k => lm.includes(k));

    if (!hasAnySignal) return;

    // Update athlete profile insights
    const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
    if (!profiles?.[0]) return;
    const existing = profiles[0].extracted_insights || "";
    const updated = await base44.integrations.Core.InvokeLLM({
      prompt: `An athlete said: "${userMessage}"\n\nExisting insights: ${existing}\n\nExtract any new health/fatigue/injury signals as a concise 1-2 sentence addition. Only add genuinely new info. Return the full updated insights string.`,
    });
    await base44.entities.AthleteProfile.update(profiles[0].id, { extracted_insights: updated });

    const today = moment().format("YYYY-MM-DD");
    const changesLog = [];

    if (hasInjury) {
      // Find next 3 planned workouts and downgrade hard sessions
      const upcoming = await base44.entities.PlannedWorkout.list("date", 20);
      const future = upcoming.filter((w) => w.date >= today && w.status === "planned").slice(0, 3);
      const injuredPart = injuryKeywords.find((k) => lm.includes(k)) || "injury";

      for (const w of future) {
        if (w.intensity === "hard" || w.intensity === "race_pace" || w.sport === "run") {
          const newDuration = Math.round((w.duration_minutes || 60) * 0.7);
          const reason = `Adjusted due to ${injuredPart} mentioned in coach chat on ${today}`;
          await base44.entities.PlannedWorkout.update(w.id, {
            intensity: "easy",
            duration_minutes: newDuration,
            ai_adjustment_reason: reason,
            status: "modified",
          });
          await base44.entities.PlanChangeLog.create({
            workout_id: w.id,
            workout_date: w.date,
            change_type: "injury_flag",
            change_summary: `Downgraded: ${w.title}`,
            reason,
            before_title: w.title,
            before_duration: w.duration_minutes,
            before_intensity: w.intensity,
            after_title: w.title,
            after_duration: newDuration,
            after_intensity: "easy",
            signal_value: injuredPart,
          });
          changesLog.push(`${w.title} on ${w.date} → reduced to easy, ${newDuration}min`);
        }
      }
    }

    if (hasFatigue && !hasInjury) {
      // Downgrade tomorrow's workout
      const tomorrow = moment().add(1, "day").format("YYYY-MM-DD");
      const tomorrowWorkouts = await base44.entities.PlannedWorkout.filter({ date: tomorrow });
      for (const w of (tomorrowWorkouts || [])) {
        if (w.status === "planned" && w.intensity !== "recovery") {
          const newDuration = Math.round((w.duration_minutes || 60) * 0.7);
          const reason = `Adjusted due to fatigue/exhaustion signal in coach chat on ${today}`;
          await base44.entities.PlannedWorkout.update(w.id, {
            intensity: "recovery",
            duration_minutes: newDuration,
            ai_adjustment_reason: reason,
            status: "modified",
          });
          await base44.entities.PlanChangeLog.create({
            workout_id: w.id,
            workout_date: w.date,
            change_type: "chat_conversation",
            change_summary: `Downgraded tomorrow: ${w.title}`,
            reason,
            before_title: w.title,
            before_duration: w.duration_minutes,
            before_intensity: w.intensity,
            after_title: w.title,
            after_duration: newDuration,
            after_intensity: "recovery",
            signal_value: "fatigue signal",
          });
          changesLog.push(`${w.title} tomorrow → reduced to recovery, ${newDuration}min`);
        }
      }
    }

    if (changesLog.length > 0 && conv) {
      const signalType = hasInjury ? "the injury signal" : "the fatigue signal";
      const followUp = `I've adjusted your upcoming sessions based on what you told me. Based on ${signalType}, I've made these changes:\n\n${changesLog.map(c => `• ${c}`).join("\n")}\n\nYour body is telling you something — let's respect that and protect your long-term fitness. We can rebuild intensity once you're feeling better.`;
      await base44.agents.addMessage(conv, { role: "assistant", content: followUp });
    }
  }

  const visibleMessages = messages.filter((m) => m.role !== "system");

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/30 shrink-0">
        <div className="p-3 border-b border-border">
          <Button onClick={() => newConv()} variant="outline" size="sm" className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingConvs ? (
            <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : convs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center p-4">No sessions yet</p>
          ) : convs.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate",
                active?.id === c.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 inline mr-2 opacity-60" />
              {c.metadata?.name || "Chat"}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">IronCoach AI</h2>
            <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-8">
              Your personal Ironman coach. Direct, data-driven, always-on.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg w-full mb-6">
              {loadingStarters ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-xl border border-border bg-card animate-pulse" />
                ))
              ) : starters.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); newConv().then((c) => { setActive(c); }); }}
                  className="p-3 rounded-xl border border-border bg-card text-sm text-left text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
            <Button onClick={() => newConv()}><Plus className="h-4 w-4 mr-2" /> Start Session</Button>
          </div>
        ) : (
          <>
            <div className="px-5 py-3.5 border-b border-border bg-card/50 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">IronCoach AI</p>
                <p className="text-[11px] text-muted-foreground">Always-on coaching engine · Full context access</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {visibleMessages.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">Start the conversation. I have full access to your metrics and plan.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {loadingStarters ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-8 w-40 rounded-full border border-border bg-secondary animate-pulse" />
                      ))
                    ) : starters.map((q) => (
                      <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {visibleMessages.map((m, i) => <MessageBubble key={i} message={m} />)}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-4 border-t border-border bg-card/50">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your coach anything…"
                  disabled={sending}
                  className="flex-1 bg-secondary/50"
                />
                <Button type="submit" disabled={sending || !input.trim()} size="icon">
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