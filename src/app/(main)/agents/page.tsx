"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import {
  agentStatusBadgeVariant,
  agentStatusDot,
  agentStatusLabel,
  mcpStatusLabel,
} from "@/lib/agent-status";

interface AgentRow {
  id: string | null;
  name: string;
  type: string;
  status: string;
  mcpStatus: string;
  mcpEndpoint?: string | null;
  lastRunAt?: string | null;
  department?: { id: string; key: string; name: string } | null;
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

type AgentsResponse = {
  agents: AgentRow[];
  departments: Array<{ id: string; key: string; name: string }>;
  department: string | null;
};

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  return agentStatusBadgeVariant(status);
}

function statusDot(status: string): "online" | "offline" | "error" {
  return agentStatusDot(status);
}

export default function AgentsPage() {
  const [department, setDepartment] = useState<string>("");

  const { data, isLoading } = useQuery<AgentsResponse>({
    queryKey: ["agents", department || "all"],
    queryFn: async () => {
      const qs = department ? `?department=${encodeURIComponent(department)}` : "";
      const res = await fetch(`/api/agents${qs}`);
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
    refetchInterval: 20000,
  });

  const agents = data?.agents ?? [];
  const departments = data?.departments ?? [];

  const departmentOptions = useMemo(
    () => [{ key: "", name: "All departments" }, ...departments],
    [departments]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg border border-border bg-secondary" />
        ))}
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="space-y-4">
        <DepartmentFilter
          value={department}
          options={departmentOptions}
          onChange={setDepartment}
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No agents registered yet. Agent runs ingested from n8n will appear here.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <DepartmentFilter
        value={department}
        options={departmentOptions}
        onChange={setDepartment}
      />
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
            <Card key={agent.id ?? agent.name}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={statusDot(agent.status)} />
                  {agent.id ? (
                    <CardTitle>
                      <Link href={`/agents/${agent.id}`} className="hover:text-primary">
                        {agent.name}
                      </Link>
                    </CardTitle>
                  ) : (
                    <CardTitle>{agent.name}</CardTitle>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {agent.department?.name ? (
                    <Badge variant="dim">{agent.department.name}</Badge>
                  ) : null}
                  <Badge variant={statusVariant(agent.status)}>{agentStatusLabel(agent.status)}</Badge>
                </div>
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
                {agent.id && (
                  <Link
                    href={`/agents/${agent.id}`}
                    className="mt-3 inline-block text-xs text-primary hover:underline"
                  >
                    View all runs →
                  </Link>
                )}
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
                key={`mcp-${agent.id ?? agent.name}`}
                className={`flex items-center gap-3 rounded-md border p-3 ${
                  agent.mcpStatus === "CONNECTED" ? "border-border" : "border-border opacity-60"
                }`}
              >
                <StatusDot status={agent.mcpStatus === "CONNECTED" ? "online" : "offline"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{agent.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">
                    {agent.mcpEndpoint || "Not configured"}
                  </div>
                </div>
                <Badge variant={agent.mcpStatus === "CONNECTED" ? "success" : "secondary"}>
                  {mcpStatusLabel(agent.mcpStatus, agent.mcpEndpoint)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DepartmentFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ key: string; name: string }>;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="agent-department" className="text-sm text-muted-foreground">
        Department
      </label>
      <select
        id="agent-department"
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.key || "all"} value={opt.key}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  );
}
