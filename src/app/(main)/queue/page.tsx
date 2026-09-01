"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  useApproveContent,
  useQueue,
  useRejectContent,
  useRequestRevision,
  type QueueFilter,
  type QueueItem,
} from "@/hooks/useQueue";
import { useContent } from "@/hooks/useContent";
import { cn } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = {
  TWITTER: "X",
  BLOG: "Blog",
  EMAIL: "Email",
  LINKEDIN: "LI",
  DISCORD: "DC",
};

const FILTERS: QueueFilter[] = ["all", "pending", "approved", "rejected", "draft"];

const APPROVE_ROLES = new Set(["ADMIN", "MANAGER", "REVIEWER"]);

const EDIT_ROLES = new Set(["ADMIN", "MANAGER", "EDITOR"]);

const SCHEDULABLE_STATUSES = new Set(["APPROVED", "SCHEDULED"]);

function statusVariant(status: string): "warning" | "success" | "destructive" | "secondary" {
  if (status === "PENDING_REVIEW" || status === "REVISION_REQUESTED") return "warning";
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "destructive";
  return "secondary";
}

function decisionErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Action failed";
  const status = (err as Error & { status?: number }).status;
  if (status === 409) return `Stale revision (409): ${err.message}`;
  if (status === 422) return `Guardian blocked (422): ${err.message}`;
  if (status === 403) return `Forbidden (403): ${err.message}`;
  return err.message;
}

function approveEditsPayload(title: string, body: string) {
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle && !trimmedBody) return undefined;
  return {
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    ...(trimmedBody ? { body: trimmedBody } : {}),
  };
}

function GuardianFlags({ flags }: { flags: unknown }) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return <p className="text-xs text-muted-foreground">No Guardian findings.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {flags.map((flag, i) => {
        const f = flag as { rule?: string; severity?: string; message?: string };
        return (
          <li key={`${f.rule ?? "flag"}-${i}`} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{f.severity ?? "INFO"}</span>
            {" · "}
            {f.message ?? f.rule ?? "Finding"}
          </li>
        );
      })}
    </ul>
  );
}

export default function QueuePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [approveTitle, setApproveTitle] = useState("");
  const [approveBody, setApproveBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  const { data, isLoading, isError, error, refetch } = useQueue(filter);
  const { data: detail, isLoading: detailLoading } = useContent(selectedId);

  const approve = useApproveContent();
  const reject = useRejectContent();
  const requestRevision = useRequestRevision();

  const canApprove = APPROVE_ROLES.has(session?.user?.role ?? "");
  const canEdit = EDIT_ROLES.has(session?.user?.role ?? "");
  const busy = approve.isPending || reject.isPending || requestRevision.isPending;

  const schedule = useMutation({
    mutationFn: async ({ contentId, at }: { contentId: string; at: string }) => {
      const res = await fetch(`/api/content/${contentId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(at).toISOString() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Schedule failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setScheduledAt("");
      toast({ title: "Scheduled", description: "Publish time saved.", variant: "success" });
      void qc.invalidateQueries({ queryKey: ["queue"] });
      void qc.invalidateQueries({ queryKey: ["content", vars.contentId] });
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const revisionId =
    detail?.currentRevision?.id ?? detail?.content.currentRevisionId ?? null;

  const selectedSummary = useMemo(
    () => items.find((i) => i.id === selectedId) as QueueItem | undefined,
    [items, selectedId]
  );

  const canEditStudio = Boolean(
    selectedSummary &&
      (selectedSummary.author.id === session?.user?.id ||
        APPROVE_ROLES.has(session?.user?.role ?? ""))
  );

  useEffect(() => {
    setScheduledAt("");
    setApproveTitle("");
    setApproveBody("");
  }, [selectedId]);

  async function runDecision(
    kind: "approve" | "reject" | "revision"
  ) {
    if (!selectedId || !revisionId) {
      setActionError("Missing content or revisionId");
      return;
    }
    setActionError(null);
    try {
      if (kind === "approve") {
        const edits = approveEditsPayload(approveTitle, approveBody);
        await approve.mutateAsync({
          contentId: selectedId,
          revisionId,
          comment: comment || undefined,
          edits,
        });
        toast({ title: "Approved", description: "Content released from queue.", variant: "success" });
      } else if (kind === "reject") {
        if (!comment.trim()) {
          setActionError("Comment required for rejection");
          return;
        }
        await reject.mutateAsync({ contentId: selectedId, revisionId, comment });
        toast({ title: "Rejected", description: "Author notified via audit trail.", variant: "default" });
      } else {
        if (!comment.trim()) {
          setActionError("Comment required when requesting revision");
          return;
        }
        await requestRevision.mutateAsync({ contentId: selectedId, revisionId, comment });
        toast({ title: "Revision requested", description: "Sent back to author.", variant: "default" });
      }
      setComment("");
      setApproveTitle("");
      setApproveBody("");
    } catch (err) {
      const msg = decisionErrorMessage(err);
      setActionError(msg);
      const status = (err as Error & { status?: number }).status;
      toast({
        title: status === 409 || status === 422 ? "Action blocked" : "Action failed",
        description: msg,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="grid animate-fade-in gap-5 lg:grid-cols-[1fr_420px]">
      <div className={cn("space-y-5", selectedId ? "hidden lg:block" : "")}>
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as QueueFilter);
            setSelectedId(null);
            setActionError(null);
          }}
        >
          <TabsList aria-label="Queue filters">
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f} aria-selected={filter === f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading queue…</p>
        )}
        {isError && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {(error as Error)?.message ?? "Failed to load queue"}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <EmptyState
            title="Queue is clear"
            reason={
              filter === "pending"
                ? "No content waiting for approval."
                : `No items in the ${filter} filter.`
            }
            action={filter === "pending" ? { label: "Open Studio", href: "/studio" } : undefined}
          />
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className={`cursor-pointer transition-colors hover:bg-secondary/30 ${
                selectedId === item.id ? "border-primary/50 bg-secondary/20" : ""
              }`}
              onClick={() => {
                setSelectedId(item.id);
                setActionError(null);
              }}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-xs font-semibold">
                  {CHANNEL_LABELS[item.channel] || item.channel.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    By {item.author?.name || item.author?.email || "Unknown"}
                    {item.campaign ? ` · ${item.campaign.name}` : ""}
                    {" · "}
                    {item.channel}
                    {" · "}
                    Guardian: {item.guardianScore}/100
                    {" · "}
                    {item.riskTier}
                    {" · "}
                    {item.origin}
                  </div>
                </div>
                <Badge variant={statusVariant(item.status)}>
                  {item.status.replace(/_/g, " ")}
                </Badge>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {item.status === "PENDING_REVIEW" && canApprove && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.currentRevisionId || busy}
                        onClick={() => {
                          const edits =
                            selectedId === item.id
                              ? approveEditsPayload(approveTitle, approveBody)
                              : undefined;
                          setSelectedId(item.id);
                          void (async () => {
                            if (!item.currentRevisionId) return;
                            setActionError(null);
                            try {
                              await approve.mutateAsync({
                                contentId: item.id,
                                revisionId: item.currentRevisionId,
                                edits,
                              });
                            } catch (err) {
                              setSelectedId(item.id);
                              setActionError(decisionErrorMessage(err));
                            }
                          })();
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="hidden sm:inline-flex"
                        onClick={() => setSelectedId(item.id)}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => setSelectedId(item.id)}>
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "space-y-4 lg:sticky lg:top-4 lg:self-start",
          selectedId ? "" : "hidden lg:block"
        )}
      >
        {!selectedId && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Select a queue item to compare revisions, review Guardian findings, and decide.
            </CardContent>
          </Card>
        )}

        {selectedId && (
          <>
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Back to queue"
                onClick={() => {
                  setSelectedId(null);
                  setActionError(null);
                }}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to queue
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {detail?.content.title ?? selectedSummary?.title ?? "Detail"}
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  {detailLoading
                    ? "Loading revision…"
                    : revisionId
                      ? `revisionId: ${revisionId}`
                      : "No current revision"}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {actionError && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {actionError}
                  </p>
                )}

                <div className="grid gap-3">
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                      Previous revision
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border border-border bg-secondary/30 p-3 text-xs whitespace-pre-wrap">
                      {detail?.priorRevision
                        ? `${detail.priorRevision.title}\n\n${detail.priorRevision.body}`
                        : "No prior revision"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                      Current revision
                    </div>
                    <div className="max-h-40 overflow-auto rounded-md border border-border bg-secondary/30 p-3 text-xs whitespace-pre-wrap">
                      {detail?.currentRevision
                        ? `${detail.currentRevision.title}\n\n${detail.currentRevision.body}`
                        : detail?.content.body ?? "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                    Guardian
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Score {detail?.guardian?.score ?? detail?.content.guardianScore ?? "—"}
                    </Badge>
                    {detail?.guardian?.result && (
                      <Badge
                        variant={
                          detail.guardian.result === "BLOCK"
                            ? "destructive"
                            : detail.guardian.result === "ALLOW"
                              ? "success"
                              : "warning"
                        }
                      >
                        {detail.guardian.result}
                      </Badge>
                    )}
                    {detail?.content.riskTier && (
                      <Badge variant="dim">{detail.content.riskTier}</Badge>
                    )}
                  </div>
                  <GuardianFlags flags={detail?.guardian?.flags ?? detail?.content.guardianFlags} />
                </div>

                {detail?.approvals && detail.approvals.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                      Approvals
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {detail.approvals.slice(0, 5).map((a) => (
                        <li key={a.id}>
                          {a.status} · {a.reviewer?.name || a.reviewer?.email}
                          {a.comment ? ` — ${a.comment}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detail?.assets && detail.assets.length > 0 && (
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                      Assets
                    </div>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {detail.assets.map((asset) => (
                        <li key={asset.id}>{asset.asset.originalFilename}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedSummary &&
                  (selectedSummary.status === "DRAFT" ||
                    selectedSummary.status === "REVISION_REQUESTED") &&
                  canEditStudio && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/studio?id=${selectedSummary.id}`}>Open in Studio</Link>
                    </Button>
                  )}

                {canApprove && detail && SCHEDULABLE_STATUSES.has(detail.content.status) && (
                  <div>
                    <label
                      htmlFor="schedule-at"
                      className="mb-1 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]"
                    >
                      Schedule
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="schedule-at"
                        type="datetime-local"
                        className="flex-1"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!scheduledAt || schedule.isPending}
                        onClick={() =>
                          schedule.mutate({ contentId: detail.content.id, at: scheduledAt })
                        }
                      >
                        {schedule.isPending ? "Scheduling…" : "Schedule"}
                      </Button>
                    </div>
                    {schedule.isError && (
                      <p className="mt-1.5 text-xs text-destructive">
                        {schedule.error instanceof Error
                          ? schedule.error.message
                          : "Schedule failed"}
                      </p>
                    )}
                    {detail.content.status === "SCHEDULED" && !schedule.isPending && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Currently scheduled — submitting again reschedules.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                    Comment
                  </label>
                  <Textarea
                    className="min-h-[72px]"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Required for reject / request revision"
                  />
                </div>

                {canApprove && (
                  <div className="space-y-3">
                    <Input
                      value={approveTitle}
                      onChange={(e) => setApproveTitle(e.target.value)}
                      placeholder="Approve with title edit (optional)"
                    />
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
                        Approve with body edit (optional)
                      </label>
                      <Textarea
                        className="min-h-[72px]"
                        value={approveBody}
                        onChange={(e) => setApproveBody(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="hidden flex-wrap gap-2 lg:flex">
                  <Button
                    size="sm"
                    disabled={!canApprove || !revisionId || busy || detail?.content.status !== "PENDING_REVIEW"}
                    onClick={() => void runDecision("approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!canApprove || !revisionId || busy}
                    onClick={() => void runDecision("reject")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canApprove || !revisionId || busy || !comment.trim()}
                    onClick={() => void runDecision("revision")}
                  >
                    Request revision
                  </Button>
                </div>
                {!canApprove && (
                  <p className="text-xs text-muted-foreground">
                    Your role cannot approve (EDITOR/VIEWER → 403).
                  </p>
                )}
              </CardContent>
            </Card>
            <div className="h-[76px] lg:hidden" aria-hidden="true" />
          </>
        )}
      </div>
      {selectedId && (
        <div
          role="group"
          aria-label="Review actions"
          className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 p-3 backdrop-blur-sm lg:hidden"
        >
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              disabled={!canApprove || !revisionId || busy || detail?.content.status !== "PENDING_REVIEW"}
              onClick={() => void runDecision("approve")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!canApprove || !revisionId || busy}
              onClick={() => void runDecision("reject")}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canApprove || !revisionId || busy || !comment.trim()}
              onClick={() => void runDecision("revision")}
            >
              Revision
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
