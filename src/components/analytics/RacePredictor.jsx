import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Calculator, Target, TrendingDown, Share2, Flag } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import ReactMarkdown from "react-markdown";
import moment from "moment";

// ── helpers ────────────────────────────────────────────────────────────────
function secsToHMS(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function paceToSecs(paceStr) {
  // accepts "4:30" or "4.5" (min/km)
  if (!paceStr) return null;
  const str = String(paceStr).trim();
  if (str.includes(":")) {
    const [m, s] = str.split(":").map(Number);
    return m * 60 + (s || 0);
  }
  return parseFloat(str) * 60;
}

function secsToMinKm(s) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")} /km`;
}

// ── race configs ───────────────────────────────────────────────────────────
const RACE_TYPES = [
  { value: "sprint_tri",     label: "Sprint Triathlon",        swim: 0.75, bike: 20,  run: 5,    t1d: 5,  t2d: 3, ftpFactor: 0.95, runFactor: 1.05, swimFactor: 0.95 },
  { value: "olympic_tri",    label: "Olympic Triathlon",       swim: 1.5,  bike: 40,  run: 10,   t1d: 5,  t2d: 3, ftpFactor: 0.90, runFactor: 1.08, swimFactor: 0.95 },
  { value: "half_ironman",   label: "Half Ironman / 70.3",     swim: 1.9,  bike: 90,  run: 21.1, t1d: 8,  t2d: 5, ftpFactor: 0.83, runFactor: 1.12, swimFactor: 1.02 },
  { value: "full_ironman",   label: "Full Ironman / 140.6",    swim: 3.8,  bike: 180, run: 42.2, t1d: 10, t2d: 6, ftpFactor: 0.75, runFactor: 1.18, swimFactor: 1.08 },
  { value: "run_5k",         label: "Running — 5km",           swim: 0,    bike: 0,   run: 5,    t1d: 0,  t2d: 0, ftpFactor: 0,    runFactor: 1.0,  swimFactor: 0 },
  { value: "run_10k",        label: "Running — 10km",          swim: 0,    bike: 0,   run: 10,   t1d: 0,  t2d: 0, ftpFactor: 0,    runFactor: 1.02, swimFactor: 0 },
  { value: "run_half",       label: "Running — Half Marathon", swim: 0,    bike: 0,   run: 21.1, t1d: 0,  t2d: 0, ftpFactor: 0,    runFactor: 1.05, swimFactor: 0 },
  { value: "run_marathon",   label: "Running — Marathon",      swim: 0,    bike: 0,   run: 42.2, t1d: 0,  t2d: 0, ftpFactor: 0,    runFactor: 1.10, swimFactor: 0 },
  { value: "run_ultra",      label: "Running — Ultra",         swim: 0,    bike: 0,   run: null, t1d: 0,  t2d: 0, ftpFactor: 0,    runFactor: 1.18, swimFactor: 0 },
  { value: "gran_fondo",     label: "Cycling — Gran Fondo",    swim: 0,    bike: null,run: 0,    t1d: 0,  t2d: 0, ftpFactor: 0.78, runFactor: 0,    swimFactor: 0 },
];

const TERRAIN_FACTORS = { flat: 1.0, rolling: 0.94, hilly: 0.87 };
const TERRAIN_RUN = { flat: 1.0, rolling: 1.06, hilly: 1.12 };
const EXP_FACTORS = { first_time: 1.10, some_experience: 1.03, experienced: 1.0 };

function calcPrediction({ raceConfig, ftp, cssSecs, thresholdSecs, t1, t2, terrain, experience, useFitness, latestMetrics }) {
  const terrainBike = TERRAIN_FACTORS[terrain] || 1;
  const terrainRun = TERRAIN_RUN[terrain] || 1;
  const expFactor = EXP_FACTORS[experience] || 1;

  let swimSecs = 0, bikeSecs = 0, runSecs = 0;
  let bikeSpeedKph = 0, bikeRacePower = 0;
  let adjustedRunPaceSecs = 0, adjustedSwimPaceSecs = 0;

  // Swim
  if (raceConfig.swim > 0 && cssSecs) {
    const adjustedCss = cssSecs * raceConfig.swimFactor * expFactor;
    adjustedSwimPaceSecs = adjustedCss;
    swimSecs = (raceConfig.swim * 1000 / 100) * adjustedCss;
  }

  // Bike
  if (raceConfig.bike > 0 && ftp) {
    bikeRacePower = ftp * raceConfig.ftpFactor;
    bikeSpeedKph = ((bikeRacePower / 30) + 15) * terrainBike;
    bikeSecs = (raceConfig.bike / bikeSpeedKph) * 3600;
  }

  // Run
  if (raceConfig.run > 0 && thresholdSecs) {
    const runFatigueAndTerrain = raceConfig.runFactor * terrainRun * expFactor;
    adjustedRunPaceSecs = thresholdSecs * runFatigueAndTerrain;
    runSecs = raceConfig.run * adjustedRunPaceSecs;
  }

  // Fitness correction
  let fitnessAdj = 1.0;
  if (useFitness && latestMetrics) {
    const tsb = latestMetrics.tsb || 0;
    if (tsb > 5) fitnessAdj *= 0.99;
    else if (tsb >= -20 && tsb <= -10) fitnessAdj *= 1.02;
    else if (tsb < -20) fitnessAdj *= 1.04;
  }

  swimSecs *= fitnessAdj;
  bikeSecs *= fitnessAdj;
  runSecs *= fitnessAdj;

  const t1Secs = (t1 || 0) * 60;
  const t2Secs = (t2 || 0) * 60;
  const totalSecs = swimSecs + t1Secs + bikeSecs + t2Secs + runSecs;

  return {
    swimSecs, bikeSecs, runSecs, t1Secs, t2Secs, totalSecs,
    bikeSpeedKph, bikeRacePower, adjustedRunPaceSecs, adjustedSwimPaceSecs,
  };
}

function qualityLabel(raceType, totalSecs) {
  // rough benchmarks for "average" amateur (seconds)
  const benchmarks = {
    sprint_tri: 4200, olympic_tri: 7800, half_ironman: 18000, full_ironman: 39600,
    run_5k: 1500, run_10k: 3300, run_half: 7200, run_marathon: 15600,
  };
  const avg = benchmarks[raceType];
  if (!avg) return "Great achievement";
  const ratio = totalSecs / avg;
  if (ratio < 0.85) return "Podium contender";
  if (ratio < 0.95) return "Strong performance";
  if (ratio < 1.1) return "Solid finish";
  return "Great achievement";
}

// ── Split bar ──────────────────────────────────────────────────────────────
function SplitBar({ label, secs, detail, color, totalSecs }) {
  const pct = totalSecs > 0 ? (secs / totalSecs) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {detail && <span className="text-muted-foreground">{detail}</span>}
          <span className="font-mono font-semibold text-foreground">{secsToHMS(secs)}</span>
        </div>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── What-if card ───────────────────────────────────────────────────────────
function WhatIfCard({ title, savings, segment }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">
        <span className="text-recovery font-semibold">−{secsToHMS(Math.abs(savings))}</span> on {segment}
      </p>
    </div>
  );
}

// ── Share modal ────────────────────────────────────────────────────────────
function ShareModal({ result, raceLabel, athleteName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Race Prediction</p>
          <h2 className="text-xl font-bold text-foreground">{athleteName}</h2>
          <p className="text-sm text-muted-foreground">{raceLabel}</p>
        </div>
        <div className="text-center py-4 border-y border-border">
          <p className="text-5xl font-bold font-mono text-primary">{secsToHMS(result.totalSecs)}</p>
          <p className="text-xs text-muted-foreground mt-1">Predicted Finish Time</p>
        </div>
        <div className="space-y-2 text-xs">
          {result.swimSecs > 0 && <div className="flex justify-between"><span className="text-blue-400">Swim</span><span className="font-mono">{secsToHMS(result.swimSecs)}</span></div>}
          {result.t1Secs > 0 && <div className="flex justify-between"><span className="text-muted-foreground">T1</span><span className="font-mono">{secsToHMS(result.t1Secs)}</span></div>}
          {result.bikeSecs > 0 && <div className="flex justify-between"><span className="text-amber-400">Bike</span><span className="font-mono">{secsToHMS(result.bikeSecs)}</span></div>}
          {result.t2Secs > 0 && <div className="flex justify-between"><span className="text-muted-foreground">T2</span><span className="font-mono">{secsToHMS(result.t2Secs)}</span></div>}
          {result.runSecs > 0 && <div className="flex justify-between"><span className="text-orange-400">Run</span><span className="font-mono">{secsToHMS(result.runSecs)}</span></div>}
        </div>
        <p className="text-center text-xs text-muted-foreground">Screenshot to share</p>
        <Button variant="outline" size="sm" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RacePredictor({ activities, metrics }) {
  const { currentUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [races, setRaces] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // inputs
  const [raceType, setRaceType] = useState("half_ironman");
  const [customRunKm, setCustomRunKm] = useState(50);
  const [customBikeKm, setCustomBikeKm] = useState(160);
  const [ftp, setFtp] = useState("");
  const [thresholdPace, setThresholdPace] = useState("");
  const [css, setCss] = useState("");
  const [t1, setT1] = useState(8);
  const [t2, setT2] = useState(5);
  const [terrain, setTerrain] = useState("flat");
  const [experience, setExperience] = useState("some_experience");
  const [useFitness, setUseFitness] = useState(true);

  // output
  const [result, setResult] = useState(null);
  const [whatIfs, setWhatIfs] = useState(null);
  const [coachNote, setCoachNote] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const raceConfig = RACE_TYPES.find(r => r.value === raceType) || RACE_TYPES[2];
  const latestMetrics = [...metrics].sort((a, b) => b.date > a.date ? 1 : -1)[0] || null;

  useEffect(() => {
    async function load() {
      const [p, r, h] = await Promise.all([
        base44.entities.AthleteProfile.filter({ created_by: currentUser.email }, "-created_date", 1),
        base44.entities.Race.filter({ created_by: currentUser.email }, "date", 10),
        base44.entities.RacePrediction.filter({ created_by: currentUser.email }, "-created_date", 50),
      ]);
      const prof = p?.[0];
      setProfile(prof);
      setRaces(r || []);
      setHistory(h || []);
      if (prof) {
        if (prof.current_ftp) setFtp(String(prof.current_ftp));
        if (prof.threshold_run_pace) setThresholdPace(prof.threshold_run_pace);
        if (prof.css_per_100m) setCss(String(prof.css_per_100m));
      }
      setLoadingProfile(false);
    }
    load();
  }, []);

  // Update T1/T2 defaults when race type changes
  useEffect(() => {
    setT1(raceConfig.t1d);
    setT2(raceConfig.t2d);
  }, [raceType]);

  function buildConfig() {
    const cfg = { ...raceConfig };
    if (raceType === "run_ultra") cfg.run = Number(customRunKm) || 50;
    if (raceType === "gran_fondo") cfg.bike = Number(customBikeKm) || 160;
    return cfg;
  }

  async function handleCalculate() {
    setCalculating(true);
    setCoachNote("");

    const cfg = buildConfig();
    const ftpNum = parseFloat(ftp) || 0;
    const cssSecs = parseFloat(css) || 0;
    const threshSecs = paceToSecs(thresholdPace) || 0;

    const res = calcPrediction({ raceConfig: cfg, ftp: ftpNum, cssSecs, thresholdSecs: threshSecs, t1, t2, terrain, experience, useFitness, latestMetrics });
    setResult(res);

    // what-ifs
    const wi1 = calcPrediction({ raceConfig: cfg, ftp: ftpNum + 10, cssSecs, thresholdSecs: threshSecs, t1, t2, terrain, experience, useFitness, latestMetrics });
    const wi2 = calcPrediction({ raceConfig: cfg, ftp: ftpNum, cssSecs, thresholdSecs: threshSecs - 10, t1, t2, terrain, experience, useFitness, latestMetrics });
    const wi3 = calcPrediction({ raceConfig: cfg, ftp: ftpNum, cssSecs, thresholdSecs: threshSecs, t1, t2, terrain, experience: "experienced", useFitness: true, latestMetrics: { ...(latestMetrics || {}), tsb: 10 } });
    setWhatIfs({ wi1, wi2, wi3, res });

    // Save prediction
    const record = {
      race_type: raceType,
      race_distance: raceConfig.label,
      predicted_swim_time: secsToHMS(res.swimSecs),
      predicted_bike_time: secsToHMS(res.bikeSecs),
      predicted_run_time: secsToHMS(res.runSecs),
      predicted_total_time: secsToHMS(res.totalSecs),
      predicted_total_seconds: res.totalSecs,
      ftp_used: ftpNum,
      threshold_pace_used: thresholdPace,
      css_used: cssSecs,
      ctl_at_prediction: latestMetrics?.ctl || null,
      atl_at_prediction: latestMetrics?.atl || null,
      tsb_at_prediction: latestMetrics?.tsb || null,
      conditions: terrain,
      experience_level: experience,
    };
    const saved = await base44.entities.RacePrediction.create(record);
    setHistory(h => [saved, ...h]);

    // Coaching note
    const note = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert triathlon/endurance coach. Based on these predicted splits:
Race: ${raceConfig.label}
Swim: ${secsToHMS(res.swimSecs)} (${res.adjustedSwimPaceSecs ? Math.round(res.adjustedSwimPaceSecs) + "s/100m" : "N/A"})
Bike: ${secsToHMS(res.bikeSecs)} (${res.bikeSpeedKph ? res.bikeSpeedKph.toFixed(1) + "kph" : "N/A"} @ ${res.bikeRacePower ? Math.round(res.bikeRacePower) + "W" : "N/A"})
Run: ${secsToHMS(res.runSecs)} (${res.adjustedRunPaceSecs ? secsToMinKm(res.adjustedRunPaceSecs) : "N/A"})
Total: ${secsToHMS(res.totalSecs)}

Athlete profile:
FTP: ${ftpNum}W
Threshold run pace: ${thresholdPace}/km
CSS: ${cssSecs}s/100m
Biggest limiter: ${profile?.biggest_limiter || "unknown"}
Experience: ${experience}
Conditions: ${terrain}

Write 3-4 sentences: identify the biggest time opportunity leg, what specific training to improve it, and a realistic goal time. Be specific with numbers. Direct coach tone.`,
    });
    setCoachNote(note);
    record.coaching_note = note;
    await base44.entities.RacePrediction.update(saved.id, { coaching_note: note });

    setCalculating(false);
  }

  async function handleSetAsGoal() {
    if (!result || races.length === 0) return;
    setSavingGoal(true);
    const targetRace = races[0]; // first (soonest) race
    await base44.entities.Race.update(targetRace.id, {
      predicted_swim_time: secsToHMS(result.swimSecs),
      predicted_bike_time: secsToHMS(result.bikeSecs),
      predicted_run_time: secsToHMS(result.runSecs),
      predicted_total_time: secsToHMS(result.totalSecs),
    });
    // Send coach message
    const conversations = await base44.agents.listConversations({ agent_name: "iron_coach" });
    if (conversations?.length > 0) {
      await base44.agents.addMessage(conversations[0], {
        role: "user",
        content: `I've set my race prediction as my goal splits for ${targetRace.name}. My target finish is ${secsToHMS(result.totalSecs)}. Please build my training around hitting these numbers.`,
      });
    }
    setSavingGoal(false);
    alert(`Goal splits saved to ${targetRace.name}!`);
  }

  // Chart data — filter to same race type
  const chartData = history
    .filter(h => h.race_type === raceType && h.predicted_total_seconds)
    .sort((a, b) => a.created_date > b.created_date ? 1 : -1)
    .map(h => ({
      date: moment(h.created_date).format("MMM D"),
      minutes: Math.round(h.predicted_total_seconds / 60),
      label: secsToHMS(h.predicted_total_seconds),
    }));

  if (loadingProfile) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const confidencePct = experience === "experienced" ? 0.03 : 0.06;
  const confLow = result ? secsToHMS(result.totalSecs * (1 - confidencePct)) : null;
  const confHigh = result ? secsToHMS(result.totalSecs * (1 + confidencePct)) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── INPUT PANEL ── */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /> Your Race</h2>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Race type</label>
            <Select value={raceType} onValueChange={setRaceType}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RACE_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {raceType === "run_ultra" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Distance (km)</label>
              <Input type="number" value={customRunKm} onChange={e => setCustomRunKm(e.target.value)} className="bg-secondary/50" />
            </div>
          )}
          {raceType === "gran_fondo" && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Bike distance (km)</label>
              <Input type="number" value={customBikeKm} onChange={e => setCustomBikeKm(e.target.value)} className="bg-secondary/50" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">FTP (watts)</label>
              <Input type="number" value={ftp} onChange={e => setFtp(e.target.value)} placeholder="e.g. 245" className="bg-secondary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Threshold pace (min/km)</label>
              <Input value={thresholdPace} onChange={e => setThresholdPace(e.target.value)} placeholder="e.g. 4:30" className="bg-secondary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">CSS (s/100m)</label>
              <Input type="number" value={css} onChange={e => setCss(e.target.value)} placeholder="e.g. 95" className="bg-secondary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">T1 (min)</label>
              <Input type="number" value={t1} onChange={e => setT1(Number(e.target.value))} className="bg-secondary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">T2 (min)</label>
              <Input type="number" value={t2} onChange={e => setT2(Number(e.target.value))} className="bg-secondary/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Terrain</label>
              <Select value={terrain} onValueChange={setTerrain}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="rolling">Rolling</SelectItem>
                  <SelectItem value="hilly">Hilly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Experience at distance</label>
              <Select value={experience} onValueChange={setExperience}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_time">First time</SelectItem>
                  <SelectItem value="some_experience">Some experience</SelectItem>
                  <SelectItem value="experienced">Well experienced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Use my current fitness data</p>
              <p className="text-xs text-muted-foreground">Applies TSB & CTL correction from recent metrics</p>
            </div>
            <Switch checked={useFitness} onCheckedChange={setUseFitness} />
          </div>

          <Button className="w-full" onClick={handleCalculate} disabled={calculating}>
            {calculating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Calculating…</> : <><Calculator className="h-4 w-4 mr-2" />Calculate</>}
          </Button>
        </div>

        {/* ── RESULTS PANEL ── */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-2">
              <Target className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">Fill in your details and hit Calculate</p>
            </div>
          ) : (
            <>
              {/* Big time */}
              <div className="text-center space-y-1 pb-4 border-b border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{raceConfig.label}</p>
                <p className="text-6xl font-bold font-mono text-primary">{secsToHMS(result.totalSecs)}</p>
                <p className="text-xs text-muted-foreground">Realistic range: {confLow} — {confHigh}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {qualityLabel(raceType, result.totalSecs)}
                </span>
              </div>

              {/* Splits */}
              <div className="space-y-3">
                {result.swimSecs > 0 && <SplitBar label="Swim" secs={result.swimSecs} detail={result.adjustedSwimPaceSecs ? `${Math.round(result.adjustedSwimPaceSecs)}s/100m` : null} color="hsl(199 89% 48%)" totalSecs={result.totalSecs} />}
                {result.t1Secs > 0 && <SplitBar label="T1" secs={result.t1Secs} color="hsl(215 20% 45%)" totalSecs={result.totalSecs} />}
                {result.bikeSecs > 0 && <SplitBar label="Bike" secs={result.bikeSecs} detail={result.bikeSpeedKph ? `${result.bikeSpeedKph.toFixed(1)}kph @ ${Math.round(result.bikeRacePower)}W` : null} color="hsl(38 92% 50%)" totalSecs={result.totalSecs} />}
                {result.t2Secs > 0 && <SplitBar label="T2" secs={result.t2Secs} color="hsl(215 20% 45%)" totalSecs={result.totalSecs} />}
                {result.runSecs > 0 && <SplitBar label="Run" secs={result.runSecs} detail={result.adjustedRunPaceSecs ? secsToMinKm(result.adjustedRunPaceSecs) : null} color="hsl(12 76% 61%)" totalSecs={result.totalSecs} />}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1" onClick={() => setShowShare(true)}>
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
                {races.length > 0 && (
                  <Button size="sm" className="gap-1.5 text-xs flex-1" disabled={savingGoal} onClick={handleSetAsGoal}>
                    {savingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                    Set as race goal
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── WHAT-IFS ── */}
      {whatIfs && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-recovery" /> What-if Scenarios</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <WhatIfCard title="If you improve FTP by 10W…" savings={whatIfs.res.bikeSecs - whatIfs.wi1.bikeSecs} segment="bike" />
            <WhatIfCard title="If you improve run threshold by 10 sec/km…" savings={whatIfs.res.runSecs - whatIfs.wi2.runSecs} segment="run" />
            <WhatIfCard title="If you race on peak form day (TSB +10)…" savings={whatIfs.res.totalSecs - whatIfs.wi3.totalSecs} segment="overall" />
          </div>
        </div>
      )}

      {/* ── COACHING NOTE ── */}
      {coachNote && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-semibold text-foreground text-sm">Improvement Roadmap</h3>
          <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none [&_p]:text-muted-foreground [&_strong]:text-foreground">
            {coachNote}
          </ReactMarkdown>
        </div>
      )}

      {/* ── PREDICTION HISTORY ── */}
      {chartData.length >= 2 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">Prediction History — {raceConfig.label}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 20% 16%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(215 20% 55%)" }} tickFormatter={v => `${Math.floor(v / 60)}h${v % 60}m`} />
              <Tooltip formatter={(v) => [`${Math.floor(v / 60)}h ${v % 60}m`, "Predicted"]} contentStyle={{ background: "hsl(222 40% 9%)", border: "1px solid hsl(222 20% 16%)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="minutes" stroke="hsl(199 89% 48%)" strokeWidth={2} dot={{ fill: "hsl(199 89% 48%)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground text-center">As your fitness improves, this line should trend down</p>
        </div>
      )}

      {showShare && result && (
        <ShareModal
          result={result}
          raceLabel={raceConfig.label}
          athleteName={currentUser?.full_name || "Athlete"}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}