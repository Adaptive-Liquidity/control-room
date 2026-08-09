"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

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
    <div className="grid grid-cols-[1fr_380px] gap-5 animate-fade-in">
      <div>
        <div className="rounded-xl border border-aeon-navy-3 bg-aeon-navy-2 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-aeon-navy-3">
            {["B", "I", "H1", "H2", "🔗", "📷", "📊", "🤖"].map((btn) => (
              <button key={btn} className="px-2.5 py-1 rounded-md bg-aeon-navy-3 text-xs text-muted-foreground hover:bg-aeon-teal hover:text-aeon-navy-1 transition-colors">{btn}</button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">Auto-saved 14:42:01</span>
          </div>
          <textarea className="w-full min-h-[400px] bg-aeon-navy-1 p-5 text-sm leading-relaxed resize-y outline-none border-none" placeholder="Start writing... The Guardian Agent will pre-flight check your content before submission." value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-4 justify-end">
          <Button variant="outline" className="border-aeon-navy-4">💾 Save Draft</Button>
          <Button variant="outline" className="border-aeon-navy-4" onClick={handleCheck} disabled={isChecking}>{isChecking ? "🛡️ Checking..." : "🛡️ Run Guardian Check"}</Button>
          <Button className="bg-gradient-to-r from-aeon-teal to-emerald-500 text-aeon-navy-1 font-bold">📤 Submit for Approval</Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="p-5 rounded-xl border border-aeon-teal/20 bg-gradient-to-br from-aeon-teal/5 to-emerald-500/5">
          <div className="flex items-center gap-2 mb-4"><span className="text-lg">🛡️</span><span className="font-bold text-aeon-teal">Guardian Pre-Flight</span></div>
          {guardianResult ? (
            <div className="space-y-2">
              {Object.entries(guardianResult.checks).map(([key, passed]: [string, any]) => (
                <div key={key} className="flex items-center gap-2 py-1.5 border-b border-aeon-teal/10 last:border-0">
                  <span className={passed ? "text-emerald-400" : "text-red-400"}>{passed ? "✓" : "✕"}</span>
                  <span className={`text-xs ${passed ? "text-emerald-400" : "text-red-400"}`}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-aeon-teal/10">
                <div className="text-[11px] text-muted-foreground mb-1">Overall Score</div>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black ${guardianResult.score >= 95 ? "text-emerald-400" : guardianResult.score >= 80 ? "text-amber-400" : "text-red-400"}`}>{guardianResult.score}</span>
                  <Progress value={guardianResult.score} className="flex-1" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Run a check to see Guardian results</p>
          )}
        </div>
        <div className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">🔮 Predictive Performance</div>
          <div className="flex items-center gap-4 mb-3">
            <span className="text-3xl font-black text-aeon-teal">A-</span>
            <div>
              <div className="text-sm font-bold">Projected Engagement: 4.8%</div>
              <div className="text-[11px] text-muted-foreground">Based on 1,247 similar posts</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>• Estimated reach: 8,200-11,400</div>
            <div>• Projected signups: 3-5</div>
            <div>• Best posting time: Tue 14:00 UTC</div>
          </div>
        </div>
        <div className="p-5 rounded-xl border border-aeon-navy-3 bg-gradient-to-br from-aeon-navy-2 to-aeon-navy-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">👁️ Live Preview</div>
          <div className="text-sm text-muted-foreground leading-relaxed">{content ? content : <span className="italic text-aeon-navy-5">Start typing to see preview...</span>}</div>
        </div>
      </div>
    </div>
  );
}
