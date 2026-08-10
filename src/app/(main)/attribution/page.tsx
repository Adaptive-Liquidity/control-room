"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AttributionPage() {
  const stats = [
    { label: "Content to Signup Rate", value: "5.5%", delta: "+1.2%" },
    { label: "Signup to Integration Rate", value: "33.8%", delta: "+4.5%" },
    { label: "Avg. Attribution Window", value: "4.2 days", delta: "Stable" },
  ];

  const rows = [
    { content: "Build Agents That Hold Money", views: "45.2K", signups: 89, integrations: 14, impact: "$2,340", roi: "12.4x" },
    { content: "The Control Plane Blog", views: "12.8K", signups: 34, integrations: 8, impact: "$1,560", roi: "8.7x" },
    { content: "Epoch Report Newsletter", views: "8.4K", signups: 22, integrations: 5, impact: "$890", roi: "6.2x" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-3 gap-4">
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
          <CardTitle>Content to Treasury Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Content</th>
                  <th className="pb-2 pr-4 font-medium">Views</th>
                  <th className="pb-2 pr-4 font-medium">Signups</th>
                  <th className="pb-2 pr-4 font-medium">Integrations</th>
                  <th className="pb-2 pr-4 font-medium">Treasury Impact</th>
                  <th className="pb-2 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.content} className="border-b border-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium">{row.content}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{row.views}</td>
                    <td className="py-3 pr-4">{row.signups}</td>
                    <td className="py-3 pr-4">{row.integrations}</td>
                    <td className="py-3 pr-4">{row.impact}</td>
                    <td className="py-3 font-medium">{row.roi}</td>
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
