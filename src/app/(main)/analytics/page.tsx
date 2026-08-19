"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
        series: Array<{ date: string; impressions: number; engagements: number }>;
        snapshotCount: number;
        dataSource: "ingested_snapshots" | "content_cache";
      }>;
    },
    refetchInterval: 30000,
  });

  const stats = [
    {
      label: "Total Impressions (30d)",
      value: data ? fmt(data.stats.totalImpressions) : "—",
      delta: data
        ? data.dataSource === "ingested_snapshots"
          ? `${data.snapshotCount} ingested snapshots`
          : "from content cache (no snapshots yet)"
        : "",
    },
    {
      label: "Cross-Channel Engagement",
      value: data ? `${data.stats.engagementRate}%` : "—",
      delta: "not live platform API",
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

  const channelChart = (data?.channels ?? []).map((c) => ({
    name: c.channel,
    impressions: c.impressions,
    engagement: c.engagementRate,
  }));

  const trendChart = (data?.series ?? []).map((s) => ({
    date: s.date.slice(5),
    impressions: s.impressions,
    engagements: s.engagements,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-xs text-muted-foreground">
        Metrics reflect ingested n8n snapshots and content counters — not live social platform APIs.
      </p>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4">
              <div className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
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

      {trendChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>30-day trend (ingested snapshots)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Impressions" />
                  <Line type="monotone" dataKey="engagements" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Engagements" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {channelChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Channel impressions (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="impressions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Impressions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Channel Performance Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.channels?.length ? (
            <p className="text-sm text-muted-foreground">
              No channel activity in this window. Metrics arrive via n8n HMAC ingest.
            </p>
          ) : (
            <ResponsiveTable
              rows={data.channels}
              rowKey={(row) => row.channel}
              rowClassName="hover:bg-secondary/30"
              columns={[
                {
                  key: "channel",
                  header: "Channel",
                  cell: (row) => <span className="font-medium">{row.channel}</span>,
                },
                { key: "pieces", header: "Pieces", cell: (row) => row.pieces },
                {
                  key: "impressions",
                  header: "Impressions",
                  cell: (row) => <span className="text-muted-foreground">{fmt(row.impressions)}</span>,
                },
                {
                  key: "engagement",
                  header: "Engagement",
                  cell: (row) => <span className="font-medium">{row.engagementRate}%</span>,
                },
                { key: "signups", header: "Signups", cell: (row) => row.signups },
                {
                  key: "top",
                  header: "Top Performer",
                  cell: (row) => <span className="text-muted-foreground">{row.topPerformer ?? "—"}</span>,
                },
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
