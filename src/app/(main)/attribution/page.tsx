"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AttributionPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["attribution"],
    queryFn: async () => {
      const res = await fetch("/api/attribution?days=30");
      if (!res.ok) throw new Error("Failed to load attribution");
      return res.json() as Promise<{
        stats: {
          contentToSignupRate: number | null;
          signupToIntegrationRate: number | null;
          views: number;
          signups: number;
          integrations: number;
          eventCount: number;
        };
        rows: Array<{
          contentId: string;
          content: string;
          views: number;
          signups: number;
          integrations: number;
          treasuryImpact: number;
          roi: number | null;
        }>;
      }>;
    },
    refetchInterval: 30000,
  });

  const stats = [
    {
      label: "Content to Signup Rate",
      value:
        data?.stats.contentToSignupRate != null ? `${data.stats.contentToSignupRate}%` : "—",
      delta: data ? `${data.stats.eventCount} events` : "",
    },
    {
      label: "Signup to Integration Rate",
      value:
        data?.stats.signupToIntegrationRate != null
          ? `${data.stats.signupToIntegrationRate}%`
          : "—",
      delta: data ? `${data.stats.signups} signups` : "",
    },
    {
      label: "Attributed Integrations",
      value: data ? String(data.stats.integrations) : "—",
      delta: data ? `${fmt(data.stats.views)} views` : "",
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <Card>
        <CardHeader>
          <CardTitle>Content to Treasury Impact</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.rows?.length ? (
            <p className="text-sm text-muted-foreground">
              No attribution rows yet. Events arrive via n8n HMAC ingest.
            </p>
          ) : (
<ResponsiveTable
              rows={data.rows}
              rowKey={(row) => row.contentId}
              columns={[
                { key: "content", header: "Content", cell: (row) => <span className="font-medium">{row.content}</span> },
                { key: "views", header: "Views", cell: (row) => <span className="text-muted-foreground">{fmt(row.views)}</span> },
                { key: "signups", header: "Signups", cell: (row) => row.signups },
                { key: "integrations", header: "Integrations", cell: (row) => row.integrations },
                { key: "treasury", header: "Treasury Impact", cell: (row) => (row.treasuryImpact ? `$${row.treasuryImpact.toLocaleString()}` : "—") },
                { key: "roi", header: "ROI", cell: (row) => <span className="font-medium">{row.roi != null ? String(row.roi) : "—"}</span> },
              ]}
              card={{
                title: (row) => row.content,
                fields: [
                  { label: "Views", value: (row) => fmt(row.views) },
                  { label: "Signups", value: (row) => row.signups },
                  { label: "Integrations", value: (row) => row.integrations },
                  { label: "Treasury Impact", value: (row) => (row.treasuryImpact ? `$${row.treasuryImpact.toLocaleString()}` : "—") },
                  { label: "ROI", value: (row) => (row.roi != null ? String(row.roi) : "—") },
                ],
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
