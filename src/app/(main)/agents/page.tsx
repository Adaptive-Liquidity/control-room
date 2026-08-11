"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";

interface AgentRow {
  id: string;
  name: string;
  type: string;
  status: string;
  mcpStatus: string;
  mcpEndpoint?: string | null;
  lastRunAt?: string | null;
  aggregates24h?: {
    runs: number;
    success: number;
    failed: number;
    successRate: number | null;
    avgLatencyMs: number | null;
    totalTokens: number;
    totalCostUsd: number;
  };
  recentRuns?: Array<{
    status: string;
    latencyMs: number | null;
    createdAt: string;
    errorMessage: string | null;
  }>;
  lastRun?: {
    status: string;
    modelAlias?: string | null;
    promptVersion?: string | null;
    createdAt: string;
  } | null;
}

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "ONLINE") return "success";
  if (status === "BUSY") return "warning";
  if (status === "ERROR") return "destructive";
  return "secondary";
}

function statusDot(status: string): "online" | "offline" | "error" {
  if (status === "ONLINE" || status === "BUSY") return "online";
  if (status === "ERROR") return "error";
  return "offline";
}

export default function AgentsPage() {
  const { data: agents, isLoading } = useQuery<AgentRow[]>({
    queryKey: ["agents"],
    queryFn: async () => {
      const res = await fetch("/api/agents");
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
    refetchInterval: 20000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border border-border bg-secondary" />
        ))}
      </div>
    );
  }

  if (!agents?.length) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No agents registered yet. Agent runs ingested from n8n will appear here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {agents.map((agent) => {
          const a = agent.aggregates24h;
          const metrics = [
            { label: "Runs (24h)", value: String(a?.runs ?? 0) },
            {
              label: "Success rate",
              value: a?.successRate != null ? `${a.successRate}%` : "—",
            },
            {
              label: "Avg latency",
              value: a?.avgLatencyMs != null ? `${a.avgLatencyMs}ms` : "—",
            },
          ];
          return (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={statusDot(agent.status)} />
                  <CardTitle>{agent.name}</CardTitle>
                </div>
                <Badge variant={statusVariant(agent.status)}>{agent.status}</Badge>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-3 gap-3">
                  {metrics.map((m) => (
                    <div key={m.label} className="text-center">
                      <div className="text-2xl font-semibold tabular-nums">{m.value}</div>
                      <div className="text-xs uppercase tracking-[0.06em] text-muted-foreground sm:text-[10px]">
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mb-2 text-xs text-muted-foreground sm:text-[11px]">
                  {agent.type}
                  {agent.lastRun?.modelAlias ? ` · ${agent.lastRun.modelAlias}` : ""}
                  {agent.lastRun?.promptVersion ? ` · ${agent.lastRun.promptVersion}` : ""}
                  {a?.totalTokens ? ` · ${a.totalTokens} tokens/24h` : ""}
                </div>
                <div className="space-y-1 rounded-md border border-border bg-secondary/50 p-3 font-mono text-xs text-muted-foreground sm:text-[11px]">
                  {(agent.recentRuns ?? []).length === 0 ? (
                    <div>No runs in the last 24h</div>
                  ) : (
                    (agent.recentRuns ?? []).slice(0, 4).map((r, i) => (
                      <div key={`${r.createdAt}-${i}`}>
                        <span className="text-muted-foreground/70">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </span>{" "}
                        {r.status}
                        {r.latencyMs != null ? ` (${r.latencyMs}ms)` : ""}
                        {r.errorMessage ? ` — ${r.errorMessage}` : ""}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCP endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {agents.map((agent) => (
              <div
                key={`mcp-${agent.id}`}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  agent.mcpStatus === "CONNECTED" ? "border-border" : "border-border opacity-60"
                }`}
              >
                <StatusDot status={agent.mcpStatus === "CONNECTED" ? "online" : "error"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">
                    {agent.mcpEndpoint || "—"}
                  </div>
                </div>
                <Badge variant={agent.mcpStatus === "CONNECTED" ? "success" : "destructive"}>
                  {agent.mcpStatus.toLowerCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
