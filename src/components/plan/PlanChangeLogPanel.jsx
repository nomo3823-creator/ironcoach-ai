import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, Filter, Clock, Heart, MessageCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import moment from "moment";

const TYPE_META = {
  hrv_drop:        { label: "HRV Drop",         icon: Heart,          color: "text-run",      bg: "bg-run/10"      },
  poor_sleep:      { label: "Poor Sleep",        icon: Clock,          color: "text-brick",    bg: "bg-brick/10"    },
  health_metric:   { label: "Health Metric",     icon: Heart,          color: "text-primary",  bg: "bg-primary/10"  },
  chat_conversation:{ label: "Chat",             icon: MessageCircle,  color: "text-recovery", bg: "bg-recovery/10" },
  missed_session:  { label: "Missed Session",    icon: AlertTriangle,  color: "text-accent",   bg: "bg-accent/10"   },
  weekly_review:   { label: "Weekly Review",     icon: RefreshCw,      color: "text-primary",  bg: "bg-primary/10"  },
  injury_flag:     { label: "Injury",            icon: AlertTriangle,  color: "text-destructive","bg": "bg-destructive/10" },
  ftp_update:      { label: "FTP/Pace Update",   icon: RefreshCw,      color: "text-accent",   bg: "bg-accent/10"   },
  manual:          { label: "Manual",            icon: RefreshCw,      color: "text-muted-foreground", bg: "bg-secondary" },
};

export default function PlanChangeLogPanel() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function load() {
      const data = await base44.entities.PlanChangeLog.filter({ created_by: currentUser.email }, "-created_date", 100);
      setLogs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.change_type === filter);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Plan Change Log</h3>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <Filter className="h-3 w-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Changes</SelectItem>
            {Object.entries(TYPE_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No plan changes logged yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Changes appear here when the AI adjusts your plan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const meta = TYPE_META[log.change_type] || TYPE_META.manual;
            const Icon = meta.icon;
            const open = expanded === log.id;
            return (
              <div key={log.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setExpanded(open ? null : log.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", meta.bg)}>
                    <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{log.change_summary}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className={cn("font-medium", meta.color)}>{meta.label}</span>
                      {log.workout_date && <span>· {moment(log.workout_date).format("MMM D")}</span>}
                      <span>· {moment(log.created_date).fromNow()}</span>
                    </div>
                  </div>
                  {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>

                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    {log.reason && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-xs text-primary leading-relaxed">
                        💬 {log.reason}
                      </div>
                    )}
                    {log.signal_value && (
                      <p className="text-xs text-muted-foreground">Signal: <span className="text-foreground font-medium">{log.signal_value}</span></p>
                    )}
                    {(log.before_title || log.after_title) && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {log.before_title && (
                          <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/10">
                            <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wider text-[10px]">Before</p>
                            <p className="text-foreground font-medium">{log.before_title}</p>
                            {log.before_duration && <p className="text-muted-foreground">{log.before_duration}min · {log.before_intensity}</p>}
                          </div>
                        )}
                        {log.after_title && (
                          <div className="p-2.5 rounded-lg bg-recovery/5 border border-recovery/10">
                            <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wider text-[10px]">After</p>
                            <p className="text-foreground font-medium">{log.after_title}</p>
                            {log.after_duration && <p className="text-muted-foreground">{log.after_duration}min · {log.after_intensity}</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}