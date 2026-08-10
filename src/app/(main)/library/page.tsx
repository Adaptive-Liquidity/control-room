"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FILTERS = ["All Assets", "Twitter Threads", "Blog Posts", "Email Templates", "Press Releases", "Ad Creatives", "Video Scripts"];

const assets = [
  { type: "Social", title: "30-Day Twitter Content Calendar", desc: "Complete thread schedule with full copy", count: "30 posts" },
  { type: "Web", title: "Website Landing Page Copy", desc: "Full website copy for all 8 sections", count: "8 sections" },
  { type: "Email", title: "Email Templates", desc: "Developer, institutional, newsletter templates", count: "3 templates" },
  { type: "PR", title: "Press Release Templates", desc: "Testnet launch and partnership announcement", count: "2 releases" },
  { type: "Ads", title: "Ad Creative Briefs", desc: "Google Search, Display, social ad copy", count: "12 creatives" },
  { type: "Video", title: "Video Scripts", desc: "90s explainer, 60s AEGIS, 2min dev tutorial", count: "3 scripts" },
  { type: "Deck", title: "Pitch Deck Outline", desc: "13-slide investor presentation structure", count: "13 slides" },
  { type: "Report", title: "Epoch Report Template", desc: "Auto-generated report structure", count: "10 sections" },
  { type: "Brand", title: "Brand Messaging Guide", desc: "Voice, forbidden words, tiered pitches", count: "Full guide" },
  { type: "Crisis", title: "Crisis Communication Playbook", desc: "Response templates for 4 scenarios", count: "4 scenarios" },
  { type: "Testing", title: "A/B Test Library", desc: "Historical test results and learnings", count: "24 tests" },
  { type: "Compliance", title: "Guardian Rule Set", desc: "Forbidden words, compliance checks", count: "47 rules" },
];

export default function LibraryPage() {
  const [activeFilter, setActiveFilter] = useState(0);

  return (
    <div className="animate-fade-in">
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <Button
            key={f}
            size="sm"
            variant={activeFilter === i ? "default" : "outline"}
            onClick={() => setActiveFilter(i)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Card key={asset.title} className="cursor-pointer transition-colors hover:bg-secondary/30">
            <CardContent className="p-5">
              <div className="mb-3 inline-flex rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {asset.type}
              </div>
              <div className="mb-1 text-sm font-medium">{asset.title}</div>
              <div className="text-xs leading-relaxed text-muted-foreground">{asset.desc}</div>
              <div className="mt-3 text-xs font-medium text-primary">{asset.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
