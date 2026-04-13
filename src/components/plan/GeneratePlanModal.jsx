import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Loader2, Sparkles } from "lucide-react";
import moment from "moment";

export default function GeneratePlanModal({ onClose }) {
  const [raceDate, setRaceDate] = useState("");
  const [distance, setDistance] = useState("140.6");
  const [hoursPerWeek, setHoursPerWeek] = useState("10");
  const [level, setLevel] = useState("intermediate");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function generate(e) {
    e.preventDefault();
    setLoading(true);
    setProgress("Analyzing your race timeline...");

    const weeksToRace = moment(raceDate).diff(moment(), "weeks");
    const profile = (await base44.entities.AthleteProfile.list("-created_date", 1))?.[0];

    setProgress("Building your periodized plan...");

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are IronCoach AI. Generate a complete Ironman training plan as a JSON array of workouts.

Race date: ${raceDate} (${weeksToRace} weeks away)
Distance: Ironman ${distance}
Hours per week: ${hoursPerWeek}
Experience: ${level}
FTP: ${profile?.current_ftp || 250}W
Threshold pace: ${profile?.threshold_run_pace || "5:00"}/km

Create ${Math.min(weeksToRace, 20)} weeks of periodized training (Base → Build → Peak → Taper).
Include swim, bike, run, brick sessions. Follow 80/20 polarized intensity.
Each week: 3-6 sessions depending on phase.

Return JSON array (max 80 workouts):`,
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

    setProgress("Saving your training plan...");

    if (result?.workouts?.length) {
      const toCreate = result.workouts.map((w) => ({ ...w, status: "planned" }));
      await base44.entities.PlannedWorkout.bulkCreate(toCreate);
    }

    setLoading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Generate Training Plan</h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} disabled={loading}><X className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{progress}</p>
          </div>
        ) : (
          <form onSubmit={generate} className="space-y-4">
            <div>
              <Label>Race Date</Label>
              <Input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} required min={moment().add(8, "weeks").format("YYYY-MM-DD")} />
            </div>
            <div>
              <Label>Race Distance</Label>
              <Select value={distance} onValueChange={setDistance}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="70.3">70.3 Half Ironman</SelectItem>
                  <SelectItem value="140.6">140.6 Full Ironman</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Available Hours / Week</Label>
              <Input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} min="6" max="20" />
            </div>
            <div>
              <Label>Experience Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner (1st triathlon)</SelectItem>
                  <SelectItem value="intermediate">Intermediate (1-3 races)</SelectItem>
                  <SelectItem value="advanced">Advanced (4+ races)</SelectItem>
                  <SelectItem value="elite">Elite / Competitive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              <Sparkles className="h-4 w-4 mr-2" /> Generate Plan
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}