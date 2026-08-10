"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

interface DashboardData {
  stats: {
    pendingApprovals: number;
    scheduledPosts: number;
    publishedThisEpoch: number;
    activeAgents: number;
    guardianPassRate: number;
    contentToDevAttribution: number;
  };
  recentQueue: any[];
  upcoming: any[];
  agents: any[];
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground/80">
          {label}
        </div>
        <div className="mt-2.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground/95">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg border border-border bg-secondary" />
        ))}
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Pending approvals" value={stats?.pendingApprovals || 0} />
        <StatCard label="Scheduled" value={stats?.scheduledPosts || 0} />
        <StatCard label="Published (7d)" value={stats?.publishedThisEpoch || 0} />
        <StatCard label="Active agents" value={`${stats?.activeAgents || 0}/4`} />
        <StatCard label="Guardian pass" value={`${stats?.guardianPassRate || 0}%`} />
        <StatCard label="Attributed signups" value={stats?.contentToDevAttribution || 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Approval queue</CardTitle>
            <Link href="/queue" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!data?.recentQueue?.length ? (
              <p className="text-sm text-muted-foreground">No pending items.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.recentQueue.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.author?.name || "Unknown"} · {item.channel}
                      </div>
                    </div>
                    <Badge variant="warning">{item.guardianScore}/100</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Agents</CardTitle>
            <Link href="/agents" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Manage
            </Link>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {(data?.agents?.length
                ? data.agents
                : [
                    { id: "1", name: "Creator", type: "CREATOR", status: "OFFLINE", mcpStatus: "DISCONNECTED" },
                    { id: "2", name: "Publisher", type: "PUBLISHER", status: "OFFLINE", mcpStatus: "DISCONNECTED" },
                    { id: "3", name: "Analyzer", type: "ANALYZER", status: "OFFLINE", mcpStatus: "DISCONNECTED" },
                    { id: "4", name: "Guardian", type: "GUARDIAN", status: "OFFLINE", mcpStatus: "DISCONNECTED" },
                  ]
              ).map((agent: any) => (
                <div key={agent.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <StatusDot status={agent.status === "ONLINE" ? "online" : "offline"} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.type} · {agent.status}
                    </div>
                  </div>
                  <Badge variant={agent.mcpStatus === "CONNECTED" ? "success" : "dim"}>
                    {agent.mcpStatus === "CONNECTED" ? "MCP" : "Idle"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Upcoming</CardTitle>
          <Link href="/calendar" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Calendar
          </Link>
        </CardHeader>
        <CardContent>
          {!data?.upcoming?.length ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Content</th>
                    <th className="pb-2 pr-4 font-medium">Channel</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcoming.map((item: any) => (
                    <tr key={item.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {item.scheduledAt
                          ? new Date(item.scheduledAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{item.title}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{item.channel}</td>
                      <td className="py-2.5">
                        <Badge variant="secondary">{item.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
