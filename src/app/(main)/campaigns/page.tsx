"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CampaignsPage() {
  const campaigns = [
    { name: "The Control Plane", status: "active", audience: "All Tiers", pieces: 24, scheduled: 12, attributions: 22 },
    { name: "Build Agents That Hold Money", status: "active", audience: "Tier 1", pieces: 18, scheduled: 8, attributions: 14 },
    { name: "Compliant By Architecture", status: "planning", audience: "Tier 4", pieces: 6, scheduled: 2, attributions: 3 },
    { name: "The Flywheel", status: "active", audience: "Tier 2", pieces: 15, scheduled: 10, attributions: 9 },
  ];

  return (
    <div className="animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Active Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Campaign</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Audience</th>
                  <th className="pb-2 pr-4 font-medium">Content</th>
                  <th className="pb-2 pr-4 font-medium">Scheduled</th>
                  <th className="pb-2 font-medium">Attributions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.name} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium">{c.name}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={c.status === "active" ? "success" : "warning"}>{c.status}</Badge>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{c.audience}</td>
                    <td className="py-3 pr-4">{c.pieces}</td>
                    <td className="py-3 pr-4">{c.scheduled}</td>
                    <td className="py-3 font-medium">{c.attributions}</td>
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
