"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCreateContent } from "@/hooks/useContent";

const TOOLBAR = ["B", "I", "H1", "H2", "Link", "Image", "Table", "AI"];

const CHANNELS = ["TWITTER", "LINKEDIN", "DISCORD", "EMAIL", "BLOG"] as const;
const TYPES = [
  "TWITTER_THREAD",
  "BLOG_POST",
  "EMAIL",
  "PRESS_RELEASE",
  "AD_CREATIVE",
  "VIDEO_SCRIPT",
  "LINKEDIN_POST",
  "DISCORD_MESSAGE",
] as const;

type GuardianResult = {
  score: number;
  result?: string;
  checks: Record<string, boolean>;
  flags?: unknown[];
};

interface AssetRow {
  id: string;
  filename: string;
  mimeType: string;
}

interface SavedDraft {
  contentId: string;
  revisionId: string;
}

function apiErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Save failed";
  const status = (err as Error & { status?: number }).status;
  if (status === 403) return `Forbidden (403): ${err.message}`;
  return err.message;
}

export default function StudioPage() {
  const router = useRouter();
  const createContent = useCreateContent();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("TWITTER");
  const [type, setType] = useState<(typeof TYPES)[number]>("TWITTER_THREAD");
  const [guardianResult, setGuardianResult] = useState<GuardianResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [altText, setAltText] = useState("");
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  const { data: assets } = useQuery<{ items: AssetRow[] }>({
    queryKey: ["assets", "studio"],
    enabled: Boolean(savedDraft),
    queryFn: async () => {
      const res = await fetch("/api/assets?limit=50");
      if (!res.ok) throw new Error("Failed to load assets");
      return res.json();
    },
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!savedDraft) throw new Error("Save the draft before attaching assets");
      const res = await fetch("/api/assets/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentRevisionId: savedDraft.revisionId,
          assetId: selectedAssetId,
          ...(altText.trim() ? { altText: altText.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Attach failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setAttachMessage("Asset attached to the current revision");
      setSelectedAssetId("");
      setAltText("");
    },
    onError: (e) => setAttachMessage(e instanceof Error ? e.message : "Attach failed"),
  });

  const handleCheck = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/guardian/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Draft", body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Guardian check failed");
      setGuardianResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Guardian check failed");
    }
    setIsChecking(false);
  };

  const save = async (status: "DRAFT" | "PENDING_REVIEW") => {
    setError(null);
    setMessage(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required");
      return;
    }
    try {
      const content = await createContent.mutateAsync({
        title: title.trim(),
        body,
        type,
        channel,
        status,
      });
      if (content?.id && content?.currentRevisionId) {
        setSavedDraft({ contentId: content.id, revisionId: content.currentRevisionId });
        setAttachMessage(null);
      }
      setMessage(
        status === "DRAFT"
          ? `Draft saved (${content.id})`
          : `Submitted for approval (${content.id})`
      );
      if (status === "PENDING_REVIEW") {
        router.push("/queue");
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="grid animate-fade-in grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
      <div>
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            {TOOLBAR.map((btn) => (
              <button
                key={btn}
                type="button"
                className="rounded-md border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground sm:px-2.5 sm:py-1"
              >
                {btn}
              </button>
            ))}
          </div>
          <div className="space-y-3 border-b border-border p-4">
            <input
              className="h-11 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring sm:h-auto"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <select
                className="h-11 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none sm:h-auto sm:text-xs"
                value={channel}
                onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="h-11 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none sm:h-auto sm:text-xs"
                value={type}
                onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            className="min-h-[280px] w-full resize-y border-none bg-card p-5 text-sm leading-relaxed outline-none sm:min-h-[400px]"
            placeholder="Start writing... The Guardian Agent will pre-flight check your content before submission."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Card>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {error && <p className="mr-auto text-xs text-destructive">{error}</p>}
          {message && !error && <p className="mr-auto text-xs text-muted-foreground">{message}</p>}
          <Button
            variant="outline"
            disabled={createContent.isPending}
            onClick={() => void save("DRAFT")}
            className="w-full sm:w-auto"
          >
            Save Draft
          </Button>
          <Button variant="outline" onClick={() => void handleCheck()} disabled={isChecking || !body.trim()} className="w-full sm:w-auto">
            {isChecking ? "Checking..." : "Run Guardian Check"}
          </Button>
          <Button
            disabled={createContent.isPending}
            onClick={() => void save("PENDING_REVIEW")}
            className="w-full sm:w-auto"
          >
            Submit for Approval
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Guardian Pre-Flight</CardTitle>
          </CardHeader>
          <CardContent>
            {guardianResult ? (
              <div className="space-y-2">
                {guardianResult.result && (
                  <Badge
                    variant={
                      guardianResult.result === "BLOCK"
                        ? "destructive"
                        : guardianResult.result === "ALLOW"
                          ? "success"
                          : "warning"
                    }
                  >
                    {guardianResult.result}
                  </Badge>
                )}
                {Object.entries(guardianResult.checks || {}).map(([key, passed]) => (
                  <div key={key} className="flex items-center gap-2 border-b border-border py-1.5 last:border-0">
                    <Badge variant={passed ? "success" : "destructive"}>{passed ? "Pass" : "Fail"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border pt-3">
                  <div className="mb-1 text-xs text-muted-foreground sm:text-[11px]">Overall Score</div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-semibold tabular-nums">{guardianResult.score}</span>
                    <Progress value={guardianResult.score} className="flex-1" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a check to see Guardian results</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
              Live Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-sm font-medium">{title || "Untitled"}</div>
            <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {body || <span className="italic">Start typing to see preview...</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            {!savedDraft ? (
              <p>
                Upload via Library (signed GCS URL). Save a draft first — assets attach to a
                content revision.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="font-mono text-[11px]">revision {savedDraft.revisionId}</p>
                <select
                  aria-label="Asset to attach"
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                  value={selectedAssetId}
                  onChange={(e) => {
                    setSelectedAssetId(e.target.value);
                    setAttachMessage(null);
                  }}
                >
                  <option value="">Select an asset…</option>
                  {(assets?.items ?? []).map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.filename}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="Alt text"
                  className="h-9 w-full rounded-md border border-border bg-card px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Alt text (optional)"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={!selectedAssetId || attach.isPending}
                  onClick={() => attach.mutate()}
                >
                  {attach.isPending ? "Attaching…" : "Attach asset"}
                </Button>
                {attachMessage && (
                  <p className={attach.isError ? "text-destructive" : "text-muted-foreground"}>
                    {attachMessage}
                  </p>
                )}
              </div>
            )}
            <a href="/library" className="inline-block text-primary hover:underline">
              Open Library →
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
