import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

export default function PendingRecommendationsBanner({ recommendations }) {
  const [hidden, setHidden] = useState(false);

  if (hidden || !recommendations?.length) return null;

  const first = recommendations[0];

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          Your coach has {recommendations.length} recommendation{recommendations.length > 1 ? "s" : ""}
        </p>
        {first && (
          <p className="text-xs text-muted-foreground mt-1">
            <span className="font-medium text-foreground">{first.workout_title}</span> on{" "}
            {first.workout_date} — {first.reason?.substring(0, 50)}...
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="ghost" className="text-xs h-7">
          Review
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setHidden(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}