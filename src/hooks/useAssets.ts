import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AssetItem {
  id: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string | null;
  originalFilename: string;
  uploadedById: string;
  createdAt: string;
  uploadedBy?: { id: string; name: string | null; email: string };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || res.statusText;
  } catch {
    return res.statusText;
  }
}

export function useAssets(opts?: { mimePrefix?: string }) {
  return useQuery({
    queryKey: ['assets', opts?.mimePrefix ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts?.mimePrefix) params.set('mimePrefix', opts.mimePrefix);
      const res = await fetch(`/api/assets?${params}`);
      if (!res.ok) throw new Error(await parseError(res));
      return res.json() as Promise<{ items: AssetItem[]; total: number }>;
    },
    refetchInterval: 30000,
  });
}

/** Signed GCS upload — never uses browser Firebase Auth. */
export function useAssetUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const urlRes = await fetch('/api/assets/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalFilename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      });
      if (!urlRes.ok) throw new Error(await parseError(urlRes));
      const { storageKey, uploadUrl, mimeType } = await urlRes.json();

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      const completeRes = await fetch('/api/assets/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey,
          originalFilename: file.name,
          mimeType,
        }),
      });
      if (!completeRes.ok) throw new Error(await parseError(completeRes));
      return completeRes.json() as Promise<{ asset: AssetItem; idempotent: boolean }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useAttachAsset() {
  return useMutation({
    mutationFn: async (opts: {
      contentRevisionId: string;
      assetId: string;
      position?: number;
      altText?: string;
    }) => {
      const res = await fetch('/api/assets/attach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(await parseError(res));
      return res.json();
    },
  });
}
