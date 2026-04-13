import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function ToolCall({ tc }) {
  const [open, setOpen] = useState(false);
  const status = tc?.status || "pending";
  const isError = tc?.results && (/error|failed/i.test(tc.results) || tc.results?.success === false);

  const cfg = {
    pending:     { icon: Clock,        color: "text-muted-foreground", label: "Pending" },
    running:     { icon: Loader2,      color: "text-primary",          label: "Running…", spin: true },
    in_progress: { icon: Loader2,      color: "text-primary",          label: "Running…", spin: true },
    completed:   isError ? { icon: AlertCircle, color: "text-destructive", label: "Failed" }
                         : { icon: CheckCircle2, color: "text-recovery",  label: "Done" },
    success:     { icon: CheckCircle2, color: "text-recovery",         label: "Done" },
    failed:      { icon: AlertCircle,  color: "text-destructive",      label: "Failed" },
    error:       { icon: AlertCircle,  color: "text-destructive",      label: "Failed" },
  }[status] || { icon: Zap, color: "text-muted-foreground", label: "" };

  const Icon = cfg.icon;
  const name = (tc?.name || "function").split(".").reverse().join(" ").toLowerCase();

  return (
    <div className="mt-1.5 text-xs">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors"
      >
        <Icon className={cn("h-3 w-3 shrink-0", cfg.color, cfg.spin && "animate-spin")} />
        <span className="text-foreground">{name}</span>
        <span className={cn("text-muted-foreground", isError && "text-destructive")}>· {cfg.label}</span>
        {!cfg.spin && (tc.arguments_string || tc.results) && (
          <ChevronRight className={cn("h-3 w-3 text-muted-foreground ml-1 transition-transform", open && "rotate-90")} />
        )}
      </button>
      {open && !cfg.spin && (
        <div className="ml-3 mt-1 pl-3 border-l-2 border-border space-y-1.5">
          {tc.arguments_string && (
            <pre className="bg-secondary rounded p-2 text-xs whitespace-pre-wrap text-secondary-foreground">
              {(() => { try { return JSON.stringify(JSON.parse(tc.arguments_string), null, 2); } catch { return tc.arguments_string; } })()}
            </pre>
          )}
          {tc.results && (
            <pre className="bg-secondary rounded p-2 text-xs whitespace-pre-wrap text-secondary-foreground max-h-40 overflow-auto">
              {typeof tc.results === "object" ? JSON.stringify(tc.results, null, 2) : tc.results}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5 shrink-0">
          <Zap className="h-3.5 w-3.5 text-primary" />
        </div>
      )}
      <div className={cn("max-w-[85%] space-y-1", isUser && "items-end flex flex-col")}>
        {message.content && (
          <div className={cn("rounded-2xl px-4 py-2.5",
            isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border"
          )}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{message.content}</p>
            ) : (
              <ReactMarkdown
                className="text-sm leading-relaxed prose prose-sm max-w-none [&_p]:text-foreground [&_p]:my-1 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:ml-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_li]:text-foreground [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded [&_code]:text-xs"
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.tool_calls?.map((tc, i) => <ToolCall key={i} tc={tc} />)}
      </div>
    </div>
  );
}