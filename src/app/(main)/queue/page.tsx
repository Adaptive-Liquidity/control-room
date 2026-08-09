"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function QueuePage() {
  const [filter, setFilter] = useState("all");

  const items = [
    { id: 1, title: "Twitter Thread: Why Feedback Control Beats Fixed Parameters", author: "Sarah Kim", channel: "TWITTER", guardianScore: 87, status: "PENDING_REVIEW" },
    { id: 2, title: "Blog Post: AEGIS Circuit Breakers Explained", author: "Dr. Elena Rossi", channel: "BLOG", guardianScore: 96, status: "PENDING_REVIEW" },
    { id: 3, title: "Email: Weekly Epoch Newsletter #1,247", author: "Marcus Johnson", channel: "EMAIL", guardianScore: 99, status: "PENDING_REVIEW" },
    { id: 4, title: "LinkedIn Post: Compliant By Architecture", author: "Alex Chen", channel: "LINKEDIN", guardianScore: 94, status: "PENDING_REVIEW" },
    { id: 5, title: "Press Release: AEON Testnet Integration", author: "Sarah Kim", channel: "BLOG", guardianScore: 91, status: "PENDING_REVIEW" },
    { id: 6, title: "Twitter Thread: The Machine Economy Has Highways", author: "Marcus Johnson", channel: "TWITTER", guardianScore: 98, status: "APPROVED" },
    { id: 7, title: "Blog Post: Swarm Treasuries Deep Dive", author: "Dr. Elena Rossi", channel: "BLOG", guardianScore: 97, status: "APPROVED" },
    { id: 8, title: "Email: Developer Onboarding #3", author: "Sarah Kim", channel: "EMAIL", guardianScore: 52, status: "REJECTED" },
  ].filter((item) => filter === "all" || item.status.toLowerCase() === filter);

  const filters = ["all", "pending", "approved", "rejected", "draft"];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === f ? "bg-aeon-teal/15 text-aeon-teal border border-aeon-teal/30" : "bg-aeon-navy-3 text-muted-foreground border border-aeon-navy-3 hover:border-aeon-navy-4"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-aeon-navy-3 bg-gradient-to-r from-aeon-navy-2 to-aeon-navy-1 hover:border-aeon-navy-4 transition-all">
            <div className="w-11 h-11 rounded-lg bg-aeon-teal/10 flex items-center justify-center text-xl">
              {item.channel === "TWITTER" ? "🐦" : item.channel === "BLOG" ? "📝" : item.channel === "EMAIL" ? "📧" : "📄"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{item.title}</div>
              <div className="text-xs text-muted-foreground">By {item.author} • {item.channel} • Guardian: {item.guardianScore}/100</div>
            </div>
            <Badge className={`text-[10px] ${item.status === "PENDING_REVIEW" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : item.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : item.status === "REJECTED" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
              {item.status}
            </Badge>
            <div className="flex gap-2">
              {item.status === "PENDING_REVIEW" && (
                <>
                  <Button size="sm" className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25">✓ Approve</Button>
                  <Button size="sm" className="bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25">✕ Reject</Button>
                </>
              )}
              <Button size="sm" variant="outline" className="border-aeon-navy-4">✎ Edit</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
