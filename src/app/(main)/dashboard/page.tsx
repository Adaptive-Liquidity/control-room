"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import {
  useApproveContent,
  useRejectContent,
  useRequestRevision,
} from "@/hooks/useQueue";

interface DashboardQueueItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  origin: string;
  guardianScore: number;
  currentRevisionId: string | null;
  author: { name: string | null; email: string } | null;
}

interface DashboardData {
  stats: {
    pendingApprovals: number;
    scheduledPosts: number;
    publishedThisEpoch: number;
    activeAgents: number;
    guardianPassRate: number;
    contentToDevAttribution: number;
  };
  recentQueue: DashboardQueueItem[];
  upcoming: any[];
  agents: any[];
}

const APPROVE_ROLES = new Set(["ADMIN", "MANAGER", "REVIEWER"]);

function decisionErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Action failed";
  const status = (err as Error & { status?: number }).status;
  if (status === 409) return `Stale revision (409): ${err.message}`;
  if (status === 422) return `Guardian blocked (422): ${err.message}`;
  if (status === 403) return `Forbidden (403): ${err.message}`;
  return err.message;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <div className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground/80 sm:text-[10px]">
          {label}
        </div>
        <div className="mt-2.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground/95">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

type CommentAction = "reject" | "revision";

function ApprovalQueuePanel({ items }: { items: DashboardQueueItem[] }) {
  const { data: session } = useSession();
  const canApprove = APPROVE_ROLES.has(session?.user?.role ?? "");
  const approve = useApproveContent();
  const reject = useRejectContent();
  const requestRevision = useRequestRevision();
  const busy = approve.isPending || reject.isPending || requestRevision.isPending;

  const [commentForId, setCommentForId] = useState<string | null>(null);
  const [commentKind, setCommentKind] = useState<CommentAction>("reject");
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const openComment = (id: string, kind: CommentAction) => {
    setCommentForId(id);
    setCommentKind(kind);
    setComment("");
    setActionError(null);
  };

  const runApprove = async (item: DashboardQueueItem) => {
    if (!item.currentRevisionId) return;
    setActionError(null);
    setCommentForId(null);
    try {
      await approve.mutateAsync({
        contentId: item.id,
        revisionId: item.currentRevisionId,
      });
    } catch (err) {
      setActionError(decisionErrorMessage(err));
    }
  };

  const runCommentAction = async (item: DashboardQueueItem) => {
    if (!item.currentRevisionId) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      setActionError("Comment required for reject / request revision");
      return;
    }
    setActionError(null);
    try {
      if (commentKind === "reject") {
        await reject.mutateAsync({
          contentId: item.id,
          revisionId: item.currentRevisionId,
          comment: trimmed,
        });
      } else {
        await requestRevision.mutateAsync({
          contentId: item.id,
          revisionId: item.currentRevisionId,
          comment: trimmed,
        });
      }
      setCommentForId(null);
      setComment("");
    } catch (err) {
      setActionError(decisionErrorMessage(err));
    }
  };

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">No pending items.</p>;
  }

  return (
    <div className="space-y-2">
      {actionError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {actionError}
        </p>
      )}
      {!canApprove && (
        <p className="text-xs text-muted-foreground">
          Your role cannot approve (EDITOR/VIEWER → open Queue to review only).
        </p>
      )}
      <div className="divide-y divide-border">
        {items.slice(0, 5).map((item) => {
          const revisionReady = Boolean(item.currentRevisionId);
          const commenting = commentForId === item.id;
          return (
            <div key={item.id} className="space-y-2 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href="/queue"
                    className="truncate text-sm font-medium transition-colors hover:text-foreground/80"
                  >
                    {item.title}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {item.author?.name || "Unknown"} · {item.channel}
                  </div>
                </div>
                <Badge variant="warning">{item.guardianScore}/100</Badge>
              </div>
              {canApprove && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!revisionReady || busy}
                    onClick={() => void runApprove(item)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!revisionReady || busy}
                    onClick={() => openComment(item.id, "reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!revisionReady || busy}
                    onClick={() => openComment(item.id, "revision")}
                  >
                    Revision
                  </Button>
                </div>
              )}
              {commenting && (
                <div className="space-y-2 rounded-md border border-border bg-secondary/40 p-2.5">
                  <label className="block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Comment ({commentKind === "reject" ? "reject" : "request revision"})
                  </label>
                  <textarea
                    className="min-h-[64px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Required"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={commentKind === "reject" ? "destructive" : "outline"}
                      disabled={busy || !comment.trim()}
                      onClick={() => void runCommentAction(item)}
                    >
                      Confirm {commentKind === "reject" ? "reject" : "revision"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setCommentForId(null);
                        setComment("");
                        setActionError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
        <StatCard label="Active agents" value={stats?.activeAgents || 0} />
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
            <ApprovalQueuePanel items={data?.recentQueue ?? []} />
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
            {!data?.agents?.length ? (
              <p className="text-sm text-muted-foreground">No agents registered yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {data.agents.map((agent: any) => (
                  <div key={agent.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <StatusDot status={agent.status === "ONLINE" || agent.status === "BUSY" ? "online" : agent.status === "ERROR" ? "error" : "offline"} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{agent.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.type} · {agent.status}
                        {agent.aggregates24h?.runs != null
                          ? ` · ${agent.aggregates24h.runs} runs/24h`
                          : ""}
                      </div>
                    </div>
                    <Badge variant={agent.mcpStatus === "CONNECTED" ? "success" : "dim"}>
                      {agent.mcpStatus === "CONNECTED" ? "MCP" : "Idle"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
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
            <ResponsiveTable
              rows={data.upcoming}
              rowKey={(item) => item.id}
              tdClassName="py-2.5"
              columns={[
                {
                  key: "date",
                  header: "Date",
                  cell: (item) => (
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString() : "—"}
                    </span>
                  ),
                },
                {
                  key: "content",
                  header: "Content",
                  cell: (item) => <span className="font-medium">{item.title}</span>,
                },
                {
                  key: "channel",
                  header: "Channel",
                  cell: (item) => <span className="text-muted-foreground">{item.channel}</span>,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (item) => <Badge variant="secondary">{item.status}</Badge>,
                },
              ]}
              card={{
                title: (item) => item.title,
                badge: (item) => <Badge variant="secondary">{item.status}</Badge>,
                fields: [
                  {
                    label: "Date",
                    value: (item) =>
                      item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString() : "—",
                  },
                  { label: "Channel", value: (item) => item.channel },
                ],
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
