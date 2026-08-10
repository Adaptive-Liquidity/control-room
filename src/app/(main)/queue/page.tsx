"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const CHANNEL_LABELS: Record<string, string> = {
  TWITTER: "X",
  BLOG: "Blog",
  EMAIL: "Email",
  LINKEDIN: "LI",
};

function statusVariant(status: string): "warning" | "success" | "destructive" | "secondary" {
  if (status === "PENDING_REVIEW") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

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
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="transition-colors hover:bg-secondary/30">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xs font-semibold">
                {CHANNEL_LABELS[item.channel] || item.channel.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  By {item.author} · {item.channel} · Guardian: {item.guardianScore}/100
                </div>
              </div>
              <Badge variant={statusVariant(item.status)}>{item.status.replace("_", " ")}</Badge>
              <div className="flex gap-2">
                {item.status === "PENDING_REVIEW" && (
                  <>
                    <Button size="sm" variant="outline">Approve</Button>
                    <Button size="sm" variant="destructive">Reject</Button>
                  </>
                )}
                <Button size="sm" variant="outline">Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
