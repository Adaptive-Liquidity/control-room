"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  useContent,
  useCreateContent,
  useSubmitContent,
  useUpdateContent,
} from "@/hooks/useContent";

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
  originalFilename: string;
  mimeType: string;
}

interface SavedDraft {
  contentId: string;
  revisionId: string;
}

interface CampaignListItem {
  id: string;
  name: string;
}

function apiErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Save failed";
  const status = (err as Error & { status?: number }).status;
  if (status === 403) return `Forbidden (403): ${err.message}`;
  return err.message;
}

function StudioPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentId = searchParams.get("id");

  const { data: detail, isLoading: detailLoading } = useContent(contentId);
  const createContent = useCreateContent();
  const updateContent = useUpdateContent();
  const submitContent = useSubmitContent();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("TWITTER");
  const [type, setType] = useState<(typeof TYPES)[number]>("TWITTER_THREAD");
  const [campaignId, setCampaignId] = useState("none");
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [guardianResult, setGuardianResult] = useState<GuardianResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [altText, setAltText] = useState("");
  const [attachMessage, setAttachMessage] = useState<string | null>(null);

  const activeContentId = savedDraft?.contentId ?? contentId;
  const activeRevisionId =
    savedDraft?.revisionId ?? detail?.content.currentRevisionId ?? null;

  function invalidateSavedDraft() {
    setSavedDraft((prev) =>
      prev ? { contentId: prev.contentId, revisionId: "" } : null
    );
    setAttachMessage(null);
  }

  useEffect(() => {
    if (!contentId) {
      if (hydratedId !== null) {
        setTitle("");
        setBody("");
        setType("TWITTER_THREAD");
        setChannel("TWITTER");
        setCampaignId("none");
        setSavedDraft(null);
        setHydratedId(null);
        setGuardianResult(null);
        setError(null);
      }
      return;
    }
    if (!detail?.content || hydratedId === contentId) return;

    const c = detail.content;
    setTitle(c.title);
    setBody(c.body);
    if (TYPES.includes(c.type as (typeof TYPES)[number])) {
      setType(c.type as (typeof TYPES)[number]);
    }
    if (CHANNELS.includes(c.channel as (typeof CHANNELS)[number])) {
      setChannel(c.channel as (typeof CHANNELS)[number]);
    }
    setCampaignId(c.campaignId ?? "none");
    if (c.id && c.currentRevisionId) {
      setSavedDraft({ contentId: c.id, revisionId: c.currentRevisionId });
    }
    setHydratedId(contentId);
  }, [contentId, detail, hydratedId]);

  const { data: campaigns } = useQuery<{ items: CampaignListItem[] }>({
    queryKey: ["campaigns", "studio"],
    queryFn: async () => {
      const res = await fetch("/api/campaigns?limit=50");
      if (!res.ok) throw new Error("Failed to load campaigns");
      return res.json();
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          type,
          ...(generatePrompt.trim() ? { prompt: generatePrompt.trim() } : {}),
          ...(title.trim() ? { titleHint: title.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Generate failed (${res.status})`);
      return data as { title: string; body: string; type?: string; channel?: string };
    },
    onSuccess: (data) => {
      setTitle(data.title);
      setBody(data.body);
      if (data.type && TYPES.includes(data.type as (typeof TYPES)[number])) {
        setType(data.type as (typeof TYPES)[number]);
      }
      if (data.channel && CHANNELS.includes(data.channel as (typeof CHANNELS)[number])) {
        setChannel(data.channel as (typeof CHANNELS)[number]);
      }
      invalidateSavedDraft();
      toast({
        title: "Draft generated",
        description: "Review and edit before saving or submitting.",
        variant: "success",
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Generate failed";
      setError(msg);
      toast({ title: "Generate failed", description: msg, variant: "destructive" });
    },
  });

  const rewrite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          type,
          contentId,
          mode: "rewrite",
          prompt: generatePrompt.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `Rewrite failed (${res.status})`) as Error & {
          status?: number;
        };
        err.status = res.status;
        throw err;
      }
      return data as { title: string; body: string; type?: string; channel?: string };
    },
    onSuccess: (data) => {
      setTitle(data.title);
      setBody(data.body);
      if (data.type && TYPES.includes(data.type as (typeof TYPES)[number])) {
        setType(data.type as (typeof TYPES)[number]);
      }
      if (data.channel && CHANNELS.includes(data.channel as (typeof CHANNELS)[number])) {
        setChannel(data.channel as (typeof CHANNELS)[number]);
      }
      invalidateSavedDraft();
      toast({
        title: "Rewrite complete",
        description: "Review the updated draft before saving or submitting.",
        variant: "success",
      });
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Rewrite failed";
      const status = (e as Error & { status?: number }).status;
      toast({
        title: status === 503 ? "Rewrite unavailable" : "Rewrite failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const { data: assets } = useQuery<{ items: AssetRow[] }>({
    queryKey: ["assets", "studio"],
    enabled: Boolean(activeContentId && activeRevisionId),
    queryFn: async () => {
      const res = await fetch("/api/assets?limit=50");
      if (!res.ok) throw new Error("Failed to load assets");
      return res.json();
    },
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (!activeRevisionId) throw new Error("Save the draft before attaching assets");
      const res = await fetch("/api/assets/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentRevisionId: activeRevisionId,
          assetId: selectedAssetId,
          ...(altText.trim() ? { altText: altText.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Attach failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      setAttachMessage("Asset attached to the current revision");
      setSelectedAssetId("");
      setAltText("");
      toast({ title: "Asset attached", variant: "success" });
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

  const isBusy =
    createContent.isPending || updateContent.isPending || submitContent.isPending;

  const save = async (status: "DRAFT" | "PENDING_REVIEW") => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError("Title and body are required");
      return;
    }

    const fields = {
      title: title.trim(),
      body,
      type,
      channel,
      campaignId: campaignId === "none" ? null : campaignId,
    };

    const persistId = savedDraft?.contentId ?? contentId;

    try {
      if (persistId) {
        const updated = await updateContent.mutateAsync({ id: persistId, ...fields });
        if (updated?.id && updated?.currentRevisionId) {
          setSavedDraft({ contentId: updated.id, revisionId: updated.currentRevisionId });
          setAttachMessage(null);
        }
        if (status === "PENDING_REVIEW") {
          await submitContent.mutateAsync(persistId);
          toast({
            title: "Submitted for approval",
            description: persistId,
            variant: "success",
          });
          router.push("/queue");
        } else {
          toast({
            title: "Draft saved",
            description: persistId,
            variant: "success",
          });
        }
      } else {
        const content = await createContent.mutateAsync({
          title: fields.title,
          body: fields.body,
          type: fields.type,
          channel: fields.channel,
          ...(campaignId !== "none" ? { campaignId } : {}),
          status,
        });
        if (content?.id && content?.currentRevisionId) {
          setSavedDraft({ contentId: content.id, revisionId: content.currentRevisionId });
          setAttachMessage(null);
        }
        toast({
          title: status === "DRAFT" ? "Draft saved" : "Submitted for approval",
          description: content.id,
          variant: "success",
        });
        if (status === "DRAFT") {
          router.replace(`/studio?id=${content.id}`);
        } else {
          router.push("/queue");
        }
      }
    } catch (e) {
      const msg = apiErrorMessage(e);
      setError(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  const revisionRequest = detail?.revisionRequest ?? null;

  return (
    <div className="grid animate-fade-in grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
      <div>
        {contentId && detailLoading && (
          <p className="mb-3 text-sm text-muted-foreground">Loading content…</p>
        )}

        {revisionRequest?.comment && (
          <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Revision requested</p>
            <p className="mt-1 text-muted-foreground">{revisionRequest.comment}</p>
            {revisionRequest.reviewerName && (
              <p className="mt-1 text-xs text-muted-foreground">
                — {revisionRequest.reviewerName}
              </p>
            )}
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="border-b border-border bg-secondary/30 px-4 py-2 text-xs text-muted-foreground">
            Plain-text editor — rich formatting toolbar disabled until markdown support ships.
          </div>
          <div className="space-y-3 border-b border-border p-4">
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                invalidateSavedDraft();
              }}
            />
            <div className="flex flex-wrap gap-3">
              <Select
                value={channel}
                onValueChange={(v) => {
                  setChannel(v as (typeof CHANNELS)[number]);
                  invalidateSavedDraft();
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v as (typeof TYPES)[number]);
                  invalidateSavedDraft();
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No campaign</SelectItem>
                  {(campaigns?.items ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                placeholder="Optional brief for AI (topic, tone, audience…)"
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                className="min-h-[60px] flex-1"
              />
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                <Button
                  variant="outline"
                  disabled={generate.isPending}
                  onClick={() => generate.mutate()}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  {generate.isPending ? "Generating…" : "Generate with AI"}
                </Button>
                {contentId && (
                  <Button
                    variant="outline"
                    disabled={rewrite.isPending}
                    onClick={() => rewrite.mutate()}
                    className="w-full sm:w-auto"
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    {rewrite.isPending ? "Rewriting…" : "Rewrite with agent"}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Textarea
            className="min-h-[280px] resize-y rounded-none border-0 bg-card focus-visible:ring-0 sm:min-h-[400px]"
            placeholder="Start writing… Run Guardian before submit. AI fills title and body — you still save or submit manually."
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              invalidateSavedDraft();
            }}
          />
        </Card>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {error && <p className="mr-auto text-xs text-destructive">{error}</p>}
          <Button
            variant="outline"
            disabled={isBusy}
            onClick={() => void save("DRAFT")}
            className="w-full sm:w-auto"
          >
            Save Draft
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleCheck()}
            disabled={isChecking || !body.trim()}
            className="w-full sm:w-auto"
          >
            {isChecking ? "Checking..." : "Run Guardian Check"}
          </Button>
          <Button
            disabled={isBusy}
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
                  <div
                    key={key}
                    className="flex items-center gap-2 border-b border-border py-1.5 last:border-0"
                  >
                    <Badge variant={passed ? "success" : "destructive"}>
                      {passed ? "Pass" : "Fail"}
                    </Badge>
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
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {body || <span className="italic">Start typing to see preview...</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            {!activeContentId || !activeRevisionId ? (
              <p>
                Upload via Library (signed GCS URL). Save a draft first — assets attach to a content
                revision.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="font-mono text-[11px]">revision {activeRevisionId}</p>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger aria-label="Asset to attach">
                    <SelectValue placeholder="Select an asset…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(assets?.items ?? []).map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.originalFilename}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  aria-label="Alt text"
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

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
      <StudioPageContent />
    </Suspense>
  );
}
