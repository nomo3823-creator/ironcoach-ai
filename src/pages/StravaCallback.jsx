import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// This page is opened in a new tab by Strava's OAuth redirect.
// It reads the code from the URL and passes it to the opener window, then closes itself.
export default function StravaCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (window.opener) {
      window.opener.postMessage({ type: "strava_callback", code, error }, "*");
      window.close();
    } else {
      // Fallback: redirect to integrations with params
      window.location.href = `/integrations?code=${code}&error=${error}`;
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Connecting Strava…</p>
      </div>
    </div>
  );
}