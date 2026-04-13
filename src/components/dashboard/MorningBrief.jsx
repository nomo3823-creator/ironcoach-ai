import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function MorningBrief({ profile, metrics, activities, readiness }) {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    generateBrief();
  }, [profile, metrics, readiness]);

  async function generateBrief() {
    if (!profile || !readiness) return;
    setLoading(true);
    try {
      const yesterday = activities?.find(a => {
        const d = new Date(a.date);
        const yd = new Date();
        yd.setDate(yd.getDate() - 1);
        return a.date === yd.toISOString().split("T")[0];
      });

      const prompt = `You are a triathlon coach. Generate a brief, personalized morning message to ${profile.user_name?.split(" ")[0] || "the athlete"}. 
Include:
- Their actual HRV (${metrics?.hrv || "not logged"}ms), sleep (${metrics?.sleep_hours || "not logged"}h), and form/TSB (${readiness?.breakdown?.tsb_value || "—"})
- What they did yesterday: ${yesterday?.title || "rest day"}
- Today's session: reference the planned workout
- One specific tip or reminder
- 4 sentences max, no bullet points.`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: "gpt_5_mini",
      });

      setBrief(res.response || "");
      setGeneratedAt(new Date());
    } catch (err) {
      console.error("Brief generation error:", err);
      setBrief("Your coach brief will appear here. Regenerate to get started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Morning Brief</h3>
        <Button size="sm" variant="ghost" onClick={generateBrief} disabled={loading} className="text-xs h-7">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Regenerate"}
        </Button>
      </div>

      <p className="text-sm text-foreground leading-relaxed">{brief || "Loading your brief..."}</p>

      {generatedAt && <p className="text-xs text-muted-foreground">Generated {generatedAt.toLocaleTimeString()}</p>}
    </div>
  );
}