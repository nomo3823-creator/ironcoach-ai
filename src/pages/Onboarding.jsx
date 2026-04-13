import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Zap, Send, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import moment from "moment";

const QUESTIONS = [
  { id: "name_history", text: "What's your name and how long have you been doing triathlon?" },
  { id: "target_race", text: "What's your target race — name, date, and is it a 70.3 or full 140.6?" },
  { id: "other_races", text: "Do you have any other races planned this season? Which is your A-priority race?" },
  { id: "weekly_volume", text: "What's your current weekly training volume in hours, broken down by swim, bike, and run?" },
  { id: "benchmarks", text: "What are your current performance benchmarks? Share your FTP for cycling, CSS or 100m pace for swimming, and threshold pace for running — whatever you know." },
  { id: "training_days", text: "What days of the week can you realistically train, and are there any hard time constraints on any of those days?" },
  { id: "injuries", text: "Have you had any injuries or physical issues in the last 12 months I should know about?" },
  { id: "biggest_limiter", text: "What's your biggest limiter right now — swim, bike, run, nutrition, or mental?" },
  { id: "motivation", text: "And finally — why are you doing this? What's driving you toward this race? This one matters, because I'll remind you of it when the training gets hard." },
];

export default function Onboarding() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState(0); // index into QUESTIONS
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("interview"); // interview | confirming | generating | done
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Redirect to dashboard if already onboarded
  useEffect(() => {
    async function checkOnboarding() {
      const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
      if (profiles?.[0]?.onboarding_complete) {
        navigate("/");
      }
    }
    checkOnboarding();
  }, []);

  // Start with welcome message
  useEffect(() => {
    setMessages([
      {
        role: "coach",
        content: `Welcome — I'm IronCoach AI, your personal Ironman training coach.\n\nBefore we build your training plan, I need to get to know you. I'll ask you ${QUESTIONS.length} questions — take your time with each one.\n\n**${QUESTIONS[0].text}**`,
      },
    ]);
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

    setMessages((m) => [...m, { role: "user", content: userMsg }]);

    const nextStep = step + 1;

    if (nextStep < QUESTIONS.length) {
      setLoading(true);
      // Brief acknowledgement then next question
      const ack = await base44.integrations.Core.InvokeLLM({
        prompt: `You are IronCoach AI onboarding a new athlete. The athlete answered: "${userMsg}" to the question "${currentQuestion.text}". Write a brief (1 sentence) natural coach acknowledgement, then on a new line ask the next question: "${QUESTIONS[nextStep].text}". Be warm, direct, and human. Do not repeat information back at length.`,
      });
      setMessages((m) => [...m, { role: "coach", content: ack }]);
      setStep(nextStep);
      setLoading(false);
    } else {
      // All answers collected — confirm summary
      setPhase("confirming");
      setLoading(true);
      const summary = await base44.integrations.Core.InvokeLLM({
        prompt: `You are IronCoach AI. You've completed the onboarding interview. Here are all the answers:\n${Object.entries(newAnswers).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nWrite a concise coach summary (3-5 bullet points) confirming back what you've understood. End with: "Is this right, or anything to correct?"`,
      });
      setMessages((m) => [...m, { role: "coach", content: summary }]);
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setPhase("generating");
    setLoading(true);
    setMessages((m) => [...m, { role: "coach", content: "Perfect. Let me build your personalized training plan now — this will take about 30 seconds..." }]);

    // Extract structured data from answers
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract structured athlete data from these onboarding answers:\n${JSON.stringify(answers, null, 2)}\n\nReturn JSON with these exact keys (use null if unknown):`,
      response_json_schema: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          experience_years: { type: "number" },
          weekly_hours_available: { type: "number" },
          current_ftp: { type: "number" },
          css_per_100m: { type: "number" },
          threshold_run_pace: { type: "string" },
          biggest_limiter: { type: "string" },
          injury_history: { type: "string" },
          available_training_days: { type: "string" },
          motivation_statement: { type: "string" },
          target_race_name: { type: "string" },
          target_race_date: { type: "string" },
          target_race_distance: { type: "string" },
          experience_level: { type: "string" },
        },
      },
    });

    // Save or update profile
    const profiles = await base44.entities.AthleteProfile.list("-created_date", 1);
    const profileData = {
      first_name: extracted.first_name,
      weekly_hours_available: extracted.weekly_hours_available,
      current_ftp: extracted.current_ftp,
      css_per_100m: extracted.css_per_100m,
      threshold_run_pace: extracted.threshold_run_pace,
      biggest_limiter: extracted.biggest_limiter,
      injury_history: extracted.injury_history,
      available_training_days: extracted.available_training_days,
      motivation_statement: extracted.motivation_statement,
      experience_level: extracted.experience_level || "intermediate",
      onboarding_complete: true,
      onboarding_raw_answers: JSON.stringify(answers),
    };

    let profileId;
    if (profiles?.[0]) {
      await base44.entities.AthleteProfile.update(profiles[0].id, profileData);
      profileId = profiles[0].id;
    } else {
      const p = await base44.entities.AthleteProfile.create(profileData);
      profileId = p.id;
    }

    // Create race if we got race data
    if (extracted.target_race_name && extracted.target_race_date) {
      const raceDate = extracted.target_race_date;
      const existingRaces = await base44.entities.Race.list("date", 5);
      const alreadyExists = existingRaces?.some((r) => r.name === extracted.target_race_name);
      if (!alreadyExists) {
        await base44.entities.Race.create({
          name: extracted.target_race_name,
          date: raceDate,
          distance: extracted.target_race_distance === "70.3" ? "70.3" : "140.6",
          priority: "A",
          checklist: [
            "Race kit laid out and tested", "Bike serviced & tuned",
            "Nutrition plan finalized", "Transition bags packed",
            "Race number & timing chip ready", "Wetsuit tested",
          ].map((item) => ({ item, checked: false })),
        });
      }

      // Generate training plan
      const weeksToRace = moment(raceDate).diff(moment(), "weeks");
      const planResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are IronCoach AI. Generate a personalized Ironman training plan for this athlete.

Athlete profile:
- Experience: ${answers.name_history}
- Weekly hours: ${extracted.weekly_hours_available}h
- FTP: ${extracted.current_ftp || "unknown"}W
- Run threshold: ${extracted.threshold_run_pace || "unknown"}/km
- Available days: ${extracted.available_training_days || "flexible"}
- Biggest limiter: ${extracted.biggest_limiter}
- Injuries: ${extracted.injury_history || "none"}
- Motivation: ${extracted.motivation_statement}

Race: ${extracted.target_race_name} on ${raceDate} (Ironman ${extracted.target_race_distance === "70.3" ? "70.3" : "140.6"})
Weeks to race: ${weeksToRace}

Generate the first 4 weeks of their periodized plan (Base Phase). Include swim, bike, run, brick, rest days. Follow 80/20 polarized intensity. Max 28 workouts total.`,
        response_json_schema: {
          type: "object",
          properties: {
            workouts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  sport: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  duration_minutes: { type: "number" },
                  intensity: { type: "string" },
                  structure: { type: "string" },
                  target_hr_zone: { type: "string" },
                  target_power: { type: "number" },
                  phase: { type: "string" },
                  week_number: { type: "number" },
                  tss_estimate: { type: "number" },
                },
              },
            },
          },
        },
      });

      if (planResult?.workouts?.length) {
        await base44.entities.PlannedWorkout.bulkCreate(
          planResult.workouts.map((w) => ({ ...w, status: "planned" }))
        );
      }
    }

    setMessages((m) => [...m, {
      role: "coach",
      content: `Your training plan is built and ready. ${extracted.motivation_statement ? `\n\n*"${extracted.motivation_statement}"*\n\nHold onto that.` : ""}\n\nLet's get to work. Head to the **Dashboard** to see today's session.`,
    }]);

    setLoading(false);
    setPhase("done");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-xl text-foreground">IronCoach AI</h1>
            <p className="text-xs text-muted-foreground">Onboarding Interview · {step}/{QUESTIONS.length} questions</p>
          </div>
          {/* Progress bar */}
          <div className="flex-1 ml-4">
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min((step / QUESTIONS.length) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
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
                  <ReactMarkdown className="text-sm leading-relaxed prose prose-sm max-w-none [&_p]:text-foreground [&_p]:my-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-4 [&_ul]:list-disc [&_li]:text-foreground">
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
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="pt-4 border-t border-border">
          {phase === "confirming" && !loading && (
            <div className="flex gap-3 mb-3">
              <Button onClick={handleConfirm} className="flex-1 bg-recovery hover:bg-recovery/90 text-white">
                <Check className="h-4 w-4 mr-2" /> Yes, that's correct — build my plan
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
                onChange={(e) => setInput(e.target.value)}
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