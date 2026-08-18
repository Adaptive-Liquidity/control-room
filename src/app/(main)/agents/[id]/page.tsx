"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { StatusDot } from "@/components/ui/status-dot";

interface AgentRun {
  id: string;
  status: string;
  workflowId: string;
  executionId: string;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  modelAlias: string | null;
  promptVersion: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface AgentDetail {
  id: string;
  name: string;
  type: string;
  status: string;
  mcpEndpoint: string | null;
  mcpStatus: string;
  lastRunAt: string | null;
  createdAt: string;
  runs: {
    items: AgentRun[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

function statusVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "ONLINE" || status === "SUCCESS") return "success";
  if (status === "BUSY" || status === "RUNNING" || status === "WAITING_APPROVAL") return "warning";
  if (status === "ERROR" || status === "FAILED") return "destructive";
  return "secondary";
}

function statusDot(status: string): "online" | "offline" | "error" {
  if (status === "ONLINE" || status === "BUSY") return "online";
  if (status === "ERROR") return "error";
  return "offline";
}

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data, isLoading, isError, error } = useQuery<AgentDetail>({
    queryKey: ["agent", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/agents/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load agent (${res.status})`);
      }
      return res.json();
    },
    refetchInterval: 20000,
  });

  return (
    <div className="animate-fade-in space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/agents">
          <ChevronLeft className="mr-1 h-4 w-4" />
          All agents
        </Link>
      </Button>

      {isLoading && <p className="text-sm text-muted-foreground">Loading agent…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load agent"}
        </p>
      )}

      {data && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2.5">
                <StatusDot status={statusDot(data.status)} />
                <CardTitle>{data.name}</CardTitle>
              </div>
              <Badge variant={statusVariant(data.status)}>{data.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground sm:text-[11px]">
                {data.type}
                {" · "}
                last run:{" "}
                {data.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : "never"}
                {" · "}
                {data.runs.total} run{data.runs.total === 1 ? "" : "s"} recorded
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border p-3">
                <StatusDot status={data.mcpStatus === "CONNECTED" ? "online" : "error"} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">MCP endpoint</div>
                  <div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">
                    {data.mcpEndpoint || "—"}
                  </div>
                </div>
                <Badge variant={data.mcpStatus === "CONNECTED" ? "success" : "destructive"}>
                  {data.mcpStatus.toLowerCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {data.runs.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No runs recorded yet. Runs are ingested from n8n via
                  /api/integrations/n8n/agent-runs.
                </p>
              ) : (
                <ResponsiveTable
                  rows={data.runs.items}
                  rowKey={(run) => run.id}
                  columns={[
                    {
                      key: "when",
                      header: "When",
                      cell: (run) => (
                        <span className="text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString()}
                        </span>
                      ),
                    },
                    {
                      key: "status",
                      header: "Status",
                      cell: (run) => (
                        <Badge variant={statusVariant(run.status)}>
                          {run.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      ),
                    },
                    {
                      key: "execution",
                      header: "Execution",
                      cell: (run) => (
                        <span className="font-mono text-xs text-muted-foreground">
                          {run.workflowId}/{run.executionId}
                        </span>
                      ),
                    },
                    {
                      key: "latency",
                      header: "Latency",
                      cell: (run) => (run.latencyMs != null ? `${run.latencyMs}ms` : "—"),
                    },
                    {
                      key: "tokens",
                      header: "Tokens",
                      cell: (run) =>
                        run.tokensIn == null && run.tokensOut == null
                          ? "—"
                          : `${run.tokensIn ?? 0} / ${run.tokensOut ?? 0}`,
                    },
                    {
                      key: "model",
                      header: "Model",
                      cell: (run) => (
                        <span className="text-muted-foreground">
                          {run.modelAlias ?? "—"}
                          {run.promptVersion ? ` · ${run.promptVersion}` : ""}
                        </span>
                      ),
                    },
                    {
                      key: "error",
                      header: "Error",
                      cell: (run) => (
                        <span className="text-destructive">
                          {run.errorMessage ?? run.errorCode ?? ""}
                        </span>
                      ),
                    },
                  ]}
                  card={{
                    title: (run) => new Date(run.createdAt).toLocaleString(),
                    badge: (run) => (
                      <Badge variant={statusVariant(run.status)}>
                        {run.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    ),
                    fields: [
                      {
                        label: "Execution",
                        value: (run) => (
                          <span className="font-mono text-xs">{run.executionId}</span>
                        ),
                      },
                      {
                        label: "Latency",
                        value: (run) => (run.latencyMs != null ? `${run.latencyMs}ms` : "—"),
                      },
                      {
                        label: "Tokens",
                        value: (run) =>
                          run.tokensIn == null && run.tokensOut == null
                            ? "—"
                            : `${run.tokensIn ?? 0} / ${run.tokensOut ?? 0}`,
                      },
                      { label: "Model", value: (run) => run.modelAlias ?? "—" },
                      {
                        label: "Error",
                        value: (run) => run.errorMessage ?? run.errorCode ?? "—",
                      },
                    ],
                  }}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
