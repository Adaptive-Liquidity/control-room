"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function statusVariant(status: string): "success" | "secondary" | "warning" {
  if (status === "running") return "success";
  if (status === "complete") return "secondary";
  return "warning";
}

export default function AbLabPage() {
  const tests = [
    { test: "Thread Hook: Highways vs Traffic Lights", variants: "A / B", channel: "Twitter", status: "running", winner: "B (+18%)", lift: "+18%", confidence: "94%" },
    { test: "CTA: Explore vs View Telemetry", variants: "A / B / C", channel: "Blog", status: "running", winner: "C (+12%)", lift: "+12%", confidence: "89%" },
    { test: "Email Subject: Emoji vs No Emoji", variants: "A / B", channel: "Email", status: "complete", winner: "A (+8%)", lift: "+8%", confidence: "97%" },
    { test: "LinkedIn Tone: Technical vs Accessible", variants: "A / B", channel: "LinkedIn", status: "planning", winner: "—", lift: "—", confidence: "—" },
  ];

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Active A/B Tests</CardTitle>
          <Button size="sm">New Test</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Test</th>
                  <th className="pb-2 pr-4 font-medium">Variants</th>
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Winner</th>
                  <th className="pb-2 pr-4 font-medium">Lift</th>
                  <th className="pb-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((row) => (
                  <tr key={row.test} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium">{row.test}</td>
                    <td className="py-3 pr-4">{row.variants}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.channel}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </td>
                    <td className="py-3 pr-4">{row.winner}</td>
                    <td className="py-3 pr-4 font-medium">{row.lift}</td>
                    <td className="py-3">{row.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
