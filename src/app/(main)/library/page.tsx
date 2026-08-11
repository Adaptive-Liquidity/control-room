"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const onPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
        <Button size="sm" disabled={upload.isPending} onClick={() => fileRef.current?.click()}>
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
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No assets yet. Upload a file to populate the library.
          </CardContent>
        </Card>
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
