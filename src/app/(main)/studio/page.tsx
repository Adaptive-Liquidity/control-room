"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const TOOLBAR = ["B", "I", "H1", "H2", "Link", "Image", "Table", "AI"];

export default function StudioPage() {
  const [content, setContent] = useState("");
  const [guardianResult, setGuardianResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch("/api/guardian/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Draft", body: content }),
      });
      const data = await res.json();
      setGuardianResult(data);
    } catch (e) {
      console.error(e);
    }
    setIsChecking(false);
  };

  return (
    <div className="grid animate-fade-in grid-cols-[1fr_380px] gap-5">
      <div>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border p-3">
            {TOOLBAR.map((btn) => (
              <button
                key={btn}
                className="rounded-md border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
              >
                {btn}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">Auto-saved 14:42:01</span>
          </div>
          <textarea
            className="min-h-[400px] w-full resize-y border-none bg-card p-5 text-sm leading-relaxed outline-none"
            placeholder="Start writing... The Guardian Agent will pre-flight check your content before submission."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Card>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline">Save Draft</Button>
          <Button variant="outline" onClick={handleCheck} disabled={isChecking}>
            {isChecking ? "Checking..." : "Run Guardian Check"}
          </Button>
          <Button>Submit for Approval</Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Guardian Pre-Flight</CardTitle>
          </CardHeader>
          <CardContent>
            {guardianResult ? (
              <div className="space-y-2">
                {Object.entries(guardianResult.checks).map(([key, passed]: [string, any]) => (
                  <div key={key} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
                    <Badge variant={passed ? "success" : "destructive"}>{passed ? "Pass" : "Fail"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <div className="mb-1 text-[11px] text-muted-foreground">Overall Score</div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-semibold tabular-nums">{guardianResult.score}</span>
                    <Progress value={guardianResult.score} className="flex-1" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a check to see Guardian results</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Predictive Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-4">
              <span className="text-2xl font-semibold text-primary">A-</span>
              <div>
                <div className="text-sm font-medium">Projected Engagement: 4.8%</div>
                <div className="text-[11px] text-muted-foreground">Based on 1,247 similar posts</div>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>Estimated reach: 8,200–11,400</div>
              <div>Projected signups: 3–5</div>
              <div>Best posting time: Tue 14:00 UTC</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm leading-relaxed text-muted-foreground">
              {content || <span className="italic">Start typing to see preview...</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
