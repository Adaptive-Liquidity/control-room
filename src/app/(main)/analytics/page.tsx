"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics?days=30");
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json() as Promise<{
        stats: {
          totalImpressions: number;
          engagementRate: number;
          contentPieces: number;
          approvalRate: number | null;
        };
        channels: Array<{
          channel: string;
          pieces: number;
          impressions: number;
          engagementRate: number;
          signups: number;
          topPerformer: string | null;
        }>;
        snapshotCount: number;
      }>;
    },
    refetchInterval: 30000,
  });

  const stats = [
    {
      label: "Total Impressions (30d)",
      value: data ? fmt(data.stats.totalImpressions) : "—",
      delta: data ? `${data.snapshotCount} snapshots` : "",
    },
    {
      label: "Cross-Channel Engagement",
      value: data ? `${data.stats.engagementRate}%` : "—",
      delta: "from ingested metrics",
    },
    {
      label: "Content Pieces (30d)",
      value: data ? String(data.stats.contentPieces) : "—",
      delta: "",
    },
    {
      label: "Approval Rate",
      value: data?.stats.approvalRate != null ? `${data.stats.approvalRate}%` : "—",
      delta: data?.stats.approvalRate == null ? "insufficient decisions" : "",
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-1.5 text-2xl font-semibold tabular-nums">
                {isLoading ? "…" : stat.value}
              </div>
              {stat.delta && <div className="mt-1 text-xs text-muted-foreground">{stat.delta}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.channels?.length ? (
            <p className="text-sm text-muted-foreground">
              No channel data yet. Metrics arrive via n8n HMAC ingest.
            </p>
          ) : (
<ResponsiveTable
              rows={data.channels}
              rowKey={(row) => row.channel}
              rowClassName="hover:bg-secondary/30"
              columns={[
                { key: "channel", header: "Channel", cell: (row) => <span className="font-medium">{row.channel}</span> },
                { key: "pieces", header: "Pieces", cell: (row) => row.pieces },
                { key: "impressions", header: "Impressions", cell: (row) => <span className="text-muted-foreground">{fmt(row.impressions)}</span> },
                { key: "engagement", header: "Engagement", cell: (row) => <span className="font-medium">{row.engagementRate}%</span> },
                { key: "signups", header: "Signups", cell: (row) => row.signups },
                { key: "top", header: "Top Performer", cell: (row) => <span className="text-muted-foreground">{row.topPerformer ?? "—"}</span> },
              ]}
              card={{
                title: (row) => row.channel,
                fields: [
                  { label: "Pieces", value: (row) => row.pieces },
                  { label: "Impressions", value: (row) => fmt(row.impressions) },
                  { label: "Engagement", value: (row) => `${row.engagementRate}%` },
                  { label: "Signups", value: (row) => row.signups },
                  { label: "Top Performer", value: (row) => row.topPerformer ?? "—" },
                ],
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
