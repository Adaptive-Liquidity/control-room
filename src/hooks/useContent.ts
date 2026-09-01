import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface ContentRevision {
  id: string;
  contentId: string;
  version: number;
  title: string;
  body: string;
  channel: string;
  type: string;
  contentHash: string;
  guardianPolicyVersion: string;
  guardianScore: number;
  guardianResult: 'ALLOW' | 'REVIEW' | 'BLOCK';
  guardianChecks: Record<string, boolean> | null;
  guardianFlags: unknown;
  createdById: string;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string };
}

export interface ContentDetail {
  content: {
    id: string;
    title: string;
    body: string;
    type: string;
    status: string;
    channel: string;
    currentRevisionId: string | null;
    riskTier: string;
    origin: string;
    guardianScore: number;
    guardianChecks: Record<string, boolean> | null;
    guardianFlags: unknown;
    version: number;
    authorId: string;
    campaignId: string | null;
    createdAt: string;
    updatedAt: string;
    author: {
      id: string;
      name: string | null;
      email: string;
      avatar: string | null;
      role: string;
    };
    campaign: { id: string; name: string } | null;
  };
  currentRevision: ContentRevision | null;
  priorRevision: ContentRevision | null;
  approvals: Array<{
    id: string;
    contentId: string;
    revisionId: string;
    reviewerId: string;
    status: string;
    comment: string | null;
    createdAt: string;
    reviewer: { id: string; name: string | null; email: string };
  }>;
  guardian: {
    policyVersion: string;
    score: number;
    result: 'ALLOW' | 'REVIEW' | 'BLOCK';
    checks: Record<string, boolean> | null;
    flags: unknown;
  } | null;
  assets?: Array<{
    id: string;
    altText: string | null;
    asset: { id: string; originalFilename: string; mimeType: string };
  }>;
  revisionRequest?: {
    comment: string | null;
    reviewerName: string | null;
    createdAt: string;
  } | null;
}

export interface CreateContentInput {
  title: string;
  body: string;
  type: string;
  channel: string;
  campaignId?: string;
  status?: 'DRAFT' | 'PENDING_REVIEW';
}

async function parseApiError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const data = await res.json();
    if (data?.error) message = data.error;
  } catch {
    // ignore
  }
  const err = new Error(message) as Error & { status?: number };
  err.status = res.status;
  return err;
}

export function useContent(id: string | null) {
  return useQuery<ContentDetail>({
    queryKey: ['content', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await fetch(`/api/content/${id}`);
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
  });
}

export function useCreateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContentInput) => {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      body?: string;
      type?: string;
      channel?: string;
      campaignId?: string | null;
    }) => {
      const res = await fetch(`/api/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['content', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useSubmitContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/content/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['content', id] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
