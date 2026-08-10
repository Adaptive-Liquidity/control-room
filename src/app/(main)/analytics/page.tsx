"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
  const stats = [
    { label: "Total Impressions (30d)", value: "2.4M", delta: "+18%" },
    { label: "Cross-Channel Engagement", value: "4.2%", delta: "+0.8%" },
    { label: "Content Pieces (30d)", value: "156", delta: "+24" },
    { label: "Approval Rate", value: "87%", delta: "+5%" },
  ];

  const channels = [
    { channel: "Twitter/X", pieces: 89, impressions: "1.8M", engagement: "4.8%", signups: 142, top: "The Control Plane thread — 45K" },
    { channel: "Blog", pieces: 24, impressions: "320K", engagement: "3.2%", signups: 68, top: "Why Feedback Control Beats Fixed" },
    { channel: "Email", pieces: 18, impressions: "180K", engagement: "22%", signups: 54, top: "Epoch Report #1,200" },
    { channel: "LinkedIn", pieces: 12, impressions: "95K", engagement: "5.1%", signups: 24, top: "Compliant By Architecture" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">{stat.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{stat.delta}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Pieces</th>
                  <th className="pb-2 pr-4 font-medium">Impressions</th>
                  <th className="pb-2 pr-4 font-medium">Engagement</th>
                  <th className="pb-2 pr-4 font-medium">Signups</th>
                  <th className="pb-2 font-medium">Top Performer</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((row) => (
                  <tr key={row.channel} className="border-b border-border/70 last:border-0 hover:bg-secondary/30">
                    <td className="py-3 pr-4 font-medium">{row.channel}</td>
                    <td className="py-3 pr-4">{row.pieces}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.impressions}</td>
                    <td className="py-3 pr-4 font-medium">{row.engagement}</td>
                    <td className="py-3 pr-4">{row.signups}</td>
                    <td className="py-3 text-muted-foreground">{row.top}</td>
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
