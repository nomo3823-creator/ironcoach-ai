import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, Zap, Plus, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import MessageBubble from "../components/chat/MessageBubble";

const STARTERS = [
  "Should I do my long run tomorrow or rest?",
  "What's my biggest weakness right now?",
  "How's my taper going?",
  "Analyze my recent training load",
];

export default function CoachChat() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => { loadConvs(); }, []);

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

  async function newConv() {
    const c = await base44.agents.createConversation({
      agent_name: "iron_coach",
      metadata: { name: `Session ${new Date().toLocaleDateString("en", { month:"short", day:"numeric" })}` },
    });
    setConvs((p) => [c, ...p]);
    setActive(c);
    setMessages([]);
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
    let conv = active;
    if (!conv) { await newConv(); return; }
    setSending(true);
    setInput("");
    await base44.agents.addMessage(conv, { role: "user", content: msg });
    setSending(false);
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/30 shrink-0">
        <div className="p-3 border-b border-border">
          <Button onClick={newConv} variant="outline" size="sm" className="w-full">
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
              Your personal Ironman coach. Direct, data-driven, always-on. Ask me anything about your training.
            </p>
            <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg w-full mb-6">
              {STARTERS.map((q) => (
                <button key={q} onClick={() => { newConv().then(() => { }); setInput(q); }} className="p-3 rounded-xl border border-border bg-card text-sm text-left text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                  {q}
                </button>
              ))}
            </div>
            <Button onClick={newConv}><Plus className="h-4 w-4 mr-2" /> Start Session</Button>
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
              {messages.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground mb-4">Start the conversation. I have full access to your metrics and plan.</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {STARTERS.map((q) => (
                      <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
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