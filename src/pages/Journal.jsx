import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import moment from "moment";

export default function Journal() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [selectedTab, setSelectedTab] = useState("all");

  useEffect(() => {
    if (!currentUser) return;
    loadEntries();
  }, [currentUser]);

  async function loadEntries() {
    try {
      const data = await base44.entities.JournalEntry.filter({ created_by: currentUser.email });
      setEntries((data || []).sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date)));
    } catch (err) {
      console.error("Failed to load journal entries:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filterEntries = () => {
    if (selectedTab === "all") return entries;
    return entries.filter(e => e.entry_type === selectedTab);
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Journal</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your training journey and patterns</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          <TabsTrigger value="workout">Workouts</TabsTrigger>
          <TabsTrigger value="reflection">Reflections</TabsTrigger>
          <TabsTrigger value="milestone">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="space-y-4 mt-6">
          {filterEntries().length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p>No entries yet. Start journaling your training!</p>
            </Card>
          ) : (
            filterEntries().map(entry => (
              <Card key={entry.id} className="p-6 space-y-3 hover:bg-secondary/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{entry.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{moment(entry.entry_date).format("MMM D, YYYY")}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {entry.entry_type}
                  </Badge>
                </div>
                {entry.content && <p className="text-sm text-foreground line-clamp-3">{entry.content}</p>}
                {entry.tags?.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-2">
                    {entry.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {entry.feeling_rating && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-sm text-muted-foreground">Feeling:</span>
                    <span className="text-lg">
                      {["😫", "😕", "😐", "🙂", "😊"][entry.feeling_rating - 1] || "—"}
                    </span>
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {entries.length > 10 && (
        <Card className="bg-secondary/30 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Monthly Pattern Analysis</h2>
          <p className="text-sm text-muted-foreground">Coming soon: AI-powered insights from your entries</p>
        </Card>
      )}
    </div>
  );
}