"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IntegrationStrip } from "@/components/layout/integration-strip";
import { useAssetUpload, useAssets } from "@/hooks/useAssets";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mime: string): string {
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("text/")) return "Text";
  return "File";
}

export default function LibraryPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useAssets();
  const upload = useAssetUpload();

  const { data: health } = useQuery({
    queryKey: ["integration-health-library"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/health");
      if (!res.ok) throw new Error("Health check failed");
      return res.json() as Promise<{ storage: { configured: boolean } }>;
    },
    staleTime: 60_000,
  });

  const storageReady = health?.storage?.configured ?? true;

  const onPick = async (file: File | null) => {
    if (!file) return;
    if (!storageReady) {
      setError("Object storage is not configured — configure in Settings first.");
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <IntegrationStrip />

      {!storageReady && (
        <EmptyState
          title="Uploads unavailable"
          reason="GCS / Firebase storage credentials are missing. Upload is blocked until configured."
          action={{ label: "Open Settings", href: "/settings" }}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          disabled={!storageReady}
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
        <Button
          size="sm"
          disabled={!storageReady || upload.isPending}
          onClick={() => storageReady && fileRef.current?.click()}
        >
          {upload.isPending ? "Uploading…" : "Upload asset"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Signed GCS upload (no browser Firebase Auth)
        </span>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-secondary" />
          ))}
        </div>
      ) : !data?.items?.length ? (
        <EmptyState
          title="Library empty"
          reason={
            storageReady
              ? "Upload approved assets for use in Studio revisions."
              : "Configure storage, then upload files."
          }
          action={storageReady ? undefined : { label: "Settings", href: "/settings" }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((asset) => (
            <Card key={asset.id} className="transition-colors hover:bg-secondary/30">
              <CardContent className="p-5">
                <div className="mb-3 inline-flex rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[10px]">
                  {mimeLabel(asset.mimeType)}
                </div>
                <div className="mb-1 truncate text-sm font-medium">{asset.originalFilename}</div>
                <div className="text-xs leading-relaxed text-muted-foreground">
                  {asset.mimeType} · {formatBytes(asset.sizeBytes)}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  {asset.uploadedBy?.name || asset.uploadedBy?.email || "Unknown"} ·{" "}
                  {new Date(asset.createdAt).toLocaleDateString()}
                </div>
                <Link href="/studio" className="mt-2 inline-block text-xs text-primary hover:underline">
                  Attach in Studio →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
