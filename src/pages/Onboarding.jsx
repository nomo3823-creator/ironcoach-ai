import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, Send, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import moment from "moment";
import { RACE_TYPES, getRaceType, calculatePhases, formatPhases } from "@/lib/raceTypes";

const QUESTIONS = [
  { id: "name_history",    text: "What's your name and how long have you been training for endurance sports?" },
  { id: "target_race",     text: "What's your target event — what type of race is it, when is it, and where?" },
  { id: "other_races",     text: "Any other races or events planned this season? Which one is your top priority?" },
  { id: "weekly_volume",   text: "What's your current weekly training volume in hours? Break it down by discipline if you can." },
  { id: "benchmarks",      text: "Share your current performance benchmarks — whatever you know. FTP, pace, threshold, swim split, anything." },
  { id: "training_days",   text: "Which days can you realistically train, and are there any hard time constraints I should know about?" },
  { id: "injuries",        text: "Any injuries, niggles, or physical issues in the past 12 months I should factor in?" },
  { id: "biggest_limiter", text: "What's your biggest limiter right now — swim, bike, run, nutrition, pacing, or mental?" },
  { id: "motivation",      text: "Last one: why are you doing this? What's driving you toward this race? This matters — I'll remind you when training gets hard." },
];

// ─── Batched plan generation ───────────────────────────────────────────────
async function generateFullPlan({ raceDate, raceType, hoursPerWeek, profile, answers, onProgress }) {
  const today = moment();
  const raceMoment = moment(raceDate);
  const totalWeeks = Math.max(1, raceMoment.diff(today, "weeks"));
  const raceTypeInfo = getRaceType(raceType);
  const phases = calculatePhases(totalWeeks, raceTypeInfo.taperWeeks);
  const sports = raceTypeInfo.sports;

  // Build phase date ranges
  const phaseRanges = [];
  let cursor = today.clone().startOf("day");

  const phaseOrder = [
    { phase: "base",      weeks: phases.base },
    { phase: "build",     weeks: phases.build },
    { phase: "peak",      weeks: phases.peak },
    { phase: "taper",     weeks: phases.taper },
  ];

  for (const p of phaseOrder) {
    if (p.weeks <= 0) continue;
    phaseRanges.push({
      phase:     p.phase,
      startDate: cursor.format("YYYY-MM-DD"),
      endDate:   cursor.clone().add(p.weeks * 7 - 1, "days").format("YYYY-MM-DD"),
      weeks:     p.weeks,
    });
    cursor.add(p.weeks * 7, "days");
  }

  // Race week
  if (totalWeeks >= 1) {
    phaseRanges.push({
      phase:     "race_week",
      startDate: raceMoment.clone().subtract(6, "days").format("YYYY-MM-DD"),
      endDate:   raceDate,
      weeks:     1,
    });
  }

  const allWorkouts = [];
  const phaseSummary = formatPhases(phases);

  for (let phIdx = 0; phIdx < phaseRanges.length; phIdx++) {
    const phaseInfo = phaseRanges[phIdx];
    onProgress?.(`${phaseInfo.phase.replace("_"," ").replace(/\b\w/g, l => l.toUpperCase())} phase (${phIdx + 1}/${phaseRanges.length})…`);

    // Split into ≤4-week batches
    let batchCursor = moment(phaseInfo.startDate);
    const phaseEnd   = moment(phaseInfo.endDate);

    while (batchCursor.isSameOrBefore(phaseEnd)) {
      const batchEnd   = moment.min(batchCursor.clone().add(27, "days"), phaseEnd);
      const batchWeeks = batchEnd.diff(batchCursor, "weeks") + 1;
      const maxWorkouts = batchWeeks * 7;

      const phaseGuidance = {
        base:      "aerobic base-building — high volume, low intensity, technique focus",
        build:     "increasing intensity, sport-specific work, threshold development",
        peak:      "race-specific intensity, highest quality sessions, sharpen fitness",
        taper:     "dramatically reduced volume (40-60% cut), maintained intensity, race-prep",
        race_week: "minimal load — 2 short openers max, rest, visualisation, race execution",
      }[phaseInfo.phase] || "balanced training";

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert endurance coach generating a training plan.

ATHLETE:
- Name: ${profile?.first_name || "Athlete"}
- Experience: ${profile?.experience_level || "intermediate"}
- Weekly hours available: ${hoursPerWeek}h
- FTP: ${profile?.current_ftp ? profile.current_ftp + "W" : "unknown"}
- Run threshold: ${profile?.threshold_run_pace || "unknown"}/km
- CSS: ${profile?.css_per_100m ? profile.css_per_100m + "s/100m" : "unknown"}
- Limiter: ${profile?.biggest_limiter || "unknown"}
- Injury history: ${profile?.injury_history || "none"}
- Available training days: ${profile?.available_training_days || "flexible"}
- Background: ${answers?.name_history || "unknown"}

TARGET RACE: ${raceTypeInfo.label} on ${raceDate}
TOTAL PLAN: ${phaseSummary} (${totalWeeks} weeks)
SPORTS FOR THIS RACE: ${sports.join(", ")}

CURRENT BATCH:
- Phase: ${phaseInfo.phase.toUpperCase()} (${phaseGuidance})
- Date range: ${batchCursor.format("YYYY-MM-DD")} → ${batchEnd.format("YYYY-MM-DD")} (${batchWeeks} weeks)
- Max sessions to generate: ${maxWorkouts}

RULES:
- 80/20 polarized intensity (≥80% easy/zone2, ≤20% hard/threshold+)
- Respect ${hoursPerWeek}h/week budget
- Rest days on non-training days
- Only generate sessions for: ${sports.join(", ")}
- Every date MUST fall within ${batchCursor.format("YYYY-MM-DD")} and ${batchEnd.format("YYYY-MM-DD")}
- Do NOT include rest days as workout records — only generate real training sessions
- For ${phaseInfo.phase === "race_week" ? "race week" : "this phase"}: ${phaseGuidance}

Return the workouts JSON array (max ${maxWorkouts} items):`,
        response_json_schema: {
          type: "object",
          properties: {
            workouts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date:             { type: "string" },
                  sport:            { type: "string" },
                  title:            { type: "string" },
                  description:      { type: "string" },
                  duration_minutes: { type: "number" },
                  intensity:        { type: "string" },
                  structure:        { type: "string" },
                  target_hr_zone:   { type: "string" },
                  target_power:     { type: "number" },
                  phase:            { type: "string" },
                  week_number:      { type: "number" },
                  tss_estimate:     { type: "number" },
                },
              },
            },
          },
        },
      });

      const batch = (result?.workouts || []).map(w => ({
        ...w,
        phase:  phaseInfo.phase,
        status: "planned",
      }));
      allWorkouts.push(...batch);

      batchCursor.add(28, "days");
    }
  }

  return allWorkouts;
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function Onboarding() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("interview"); // interview | confirming | generating | done
  const [loading, setLoading] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const scrollRef = useRef(null);

  // Redirect if already onboarded
  useEffect(() => {
    async function checkOnboarding() {
      const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
      if (profiles?.[0]?.onboarding_complete) navigate("/");
    }
    checkOnboarding();
  }, []);

  // Welcome message
  useEffect(() => {
    setMessages([{
      role: "coach",
      content: `Welcome — I'm your personal endurance coach.\n\nI need to get to know you before we build your training plan. I'll ask ${QUESTIONS.length} questions — take your time with each.\n\n**${QUESTIONS[0].text}**`,
    }]);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    const currentQuestion = QUESTIONS[step];
    const newAnswers = { ...answers, [currentQuestion.id]: userMsg };
    setAnswers(newAnswers);
    setMessages(m => [...m, { role: "user", content: userMsg }]);

    const nextStep = step + 1;
    if (nextStep < QUESTIONS.length) {
      setLoading(true);
      const ack = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an endurance coach onboarding a new athlete. They answered: "${userMsg}" to: "${currentQuestion.text}". Write one brief natural acknowledgement (1 sentence), then ask: "${QUESTIONS[nextStep].text}". Be warm, direct, human. No repeating info back at length.`,
      });
      setMessages(m => [...m, { role: "coach", content: ack }]);
      setStep(nextStep);
      setLoading(false);
    } else {
      // All questions answered — generate summary for confirmation
      setPhase("confirming");
      setLoading(true);
      const summary = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an endurance coach. Summarize what you've learned from this onboarding interview in 4-5 bullet points. Be specific — include the actual race, dates, benchmarks, and key facts. End with: "Is this right, or anything to correct?"\n\nAnswers:\n${Object.entries(newAnswers).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
      });
      setMessages(m => [...m, { role: "coach", content: summary }]);
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setPhase("generating");
    setLoading(true);
    setMessages(m => [...m, { role: "coach", content: "Building your plan now — this takes about 30–60 seconds…" }]);

    try {
    // ── Extract structured data from answers ──
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract structured athlete data from these onboarding answers:\n${JSON.stringify(answers, null, 2)}\n\nReturn the JSON object. For race_type, pick the best match from: sprint_tri, olympic_tri, 70.3, 140.6, 5k, 10k, half_marathon, marathon, ultramarathon, gran_fondo, century_ride, open_water, custom. For target_race_date, return YYYY-MM-DD format. For experience_level: beginner, intermediate, advanced, or elite.`,
      response_json_schema: {
        type: "object",
        properties: {
          first_name:             { type: "string" },
          experience_years:       { type: "number" },
          weekly_hours_available: { type: "number" },
          current_ftp:            { type: "number" },
          css_per_100m:           { type: "number" },
          threshold_run_pace:     { type: "string" },
          biggest_limiter:        { type: "string" },
          injury_history:         { type: "string" },
          available_training_days:{ type: "string" },
          motivation_statement:   { type: "string" },
          target_race_name:       { type: "string" },
          target_race_date:       { type: "string" },
          target_race_distance:   { type: "string" },
          race_type:              { type: "string" },
          experience_level:       { type: "string" },
        },
      },
    });

    // ── Save / update athlete profile ──
    const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
    const profileData = {
      first_name:              extracted.first_name,
      weekly_hours_available:  extracted.weekly_hours_available,
      current_ftp:             extracted.current_ftp,
      css_per_100m:            extracted.css_per_100m,
      threshold_run_pace:      extracted.threshold_run_pace,
      biggest_limiter:         extracted.biggest_limiter,
      injury_history:          extracted.injury_history,
      available_training_days: extracted.available_training_days,
      motivation_statement:    extracted.motivation_statement,
      experience_level:        extracted.experience_level || "intermediate",
      race_type:               extracted.race_type || "custom",
      onboarding_complete:     true,
      onboarding_raw_answers:  JSON.stringify(answers),
    };

    let savedProfile;
    if (profiles?.[0]) {
      await base44.entities.AthleteProfile.update(profiles[0].id, profileData);
      savedProfile = { ...profiles[0], ...profileData };
    } else {
      savedProfile = await base44.entities.AthleteProfile.create(profileData);
    }

    // ── Create Race entity ──
    const raceDate    = extracted.target_race_date;
    const raceType    = extracted.race_type || "custom";
    const raceTypeInfo = getRaceType(raceType);

    if (extracted.target_race_name && raceDate) {
      const existingRaces = await base44.entities.Race.list("date", 5);
      const alreadyExists = existingRaces?.some(r => r.name === extracted.target_race_name);
      if (!alreadyExists) {
        await base44.entities.Race.create({
          name:      extracted.target_race_name,
          date:      raceDate,
          distance:  extracted.target_race_distance || raceType,
          race_type: raceType,
          priority:  "A",
          checklist: [
            "Race kit laid out and tested",
            "Equipment serviced & tuned",
            "Nutrition plan finalized",
            "Race number & timing chip ready",
            "Travel & accommodation confirmed",
            "Pre-race meal planned",
            "GPS watch charged",
          ].map(item => ({ item, checked: false })),
        });
      }
    }

    // ── Generate full periodized plan ──
    if (raceDate) {
      setGenProgress("Starting plan generation…");
      const hoursPerWeek = extracted.weekly_hours_available || 10;
      const totalWeeks   = moment(raceDate).diff(moment(), "weeks");
      const phases       = calculatePhases(totalWeeks, raceTypeInfo.taperWeeks);
      const phaseSummary = formatPhases(phases);

      setMessages(m => [...m, { role: "coach", content: `Total weeks: ${totalWeeks} · ${phaseSummary}\n\nGenerating your complete plan…` }]);

      const workouts = await generateFullPlan({
        raceDate,
        raceType,
        hoursPerWeek,
        profile:    savedProfile,
        answers,
        onProgress: (msg) => setGenProgress(msg),
      });

      if (workouts.length > 0) {
        setGenProgress("Saving plan to your calendar…");
        // Bulk create in chunks of 50 to avoid payload limits
        for (let i = 0; i < workouts.length; i += 50) {
          await base44.entities.PlannedWorkout.bulkCreate(workouts.slice(i, i + 50));
        }
      }
    }

    setMessages(m => [...m, {
      role: "coach",
      content: `Your plan is ready — ${extracted.target_race_name ? `all the way to **${extracted.target_race_name}**` : "through race day"}.\n\n${extracted.motivation_statement ? `> *"${extracted.motivation_statement}"*\n\nHold onto that.` : ""}\n\nHead to the **Dashboard** to see today's session.`,
    }]);

    setLoading(false);
    setGenProgress("");
    setPhase("done");
    } catch (err) {
      console.error("Onboarding confirm failed:", err);
      setMessages(m => [...m, {
        role: "coach",
        content: `Something went wrong saving your profile: ${err?.message || "unknown error"}. Please try again.`,
      }]);
      setLoading(false);
      setGenProgress("");
      setPhase("confirming");
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col h-[92vh]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-xl text-foreground leading-none">Endurance Coach AI</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {phase === "interview" ? `Question ${step + 1} of ${QUESTIONS.length}` :
               phase === "confirming" ? "Confirming your profile" :
               phase === "generating" ? (genProgress || "Building your plan…") :
               "All done!"}
            </p>
          </div>
          {/* Progress bar */}
          <div className="w-24 shrink-0">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(((phase === "done" ? QUESTIONS.length : step) / QUESTIONS.length) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "coach" && (
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}>
                {msg.role === "user" ? (
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                ) : (
                  <ReactMarkdown className="text-sm leading-relaxed prose prose-sm max-w-none [&_p]:text-foreground [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-4 [&_ul]:list-disc [&_li]:text-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground">
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                {genProgress && <span className="text-sm text-muted-foreground">{genProgress}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="pt-4 border-t border-border shrink-0">
          {phase === "confirming" && !loading && (
            <div className="flex gap-3 mb-3">
              <Button
                onClick={handleConfirm}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" /> Yes — build my plan
              </Button>
              <Button variant="outline" onClick={() => {
                setPhase("interview");
                setStep(0);
                setAnswers({});
                setMessages([{ role: "coach", content: `No problem — let's start over.\n\n**${QUESTIONS[0].text}**` }]);
              }}>
                Start over
              </Button>
            </div>
          )}
          {phase === "done" && (
            <Button className="w-full" onClick={() => navigate("/")}>
              Go to Dashboard →
            </Button>
          )}
          {phase === "interview" && (
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your answer…"
                disabled={loading}
                className="flex-1 bg-secondary/50"
                autoFocus
              />
              <Button type="submit" disabled={loading || !input.trim()} size="icon">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
