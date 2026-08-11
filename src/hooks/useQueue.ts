import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type QueueFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'draft';

export interface QueueItem {
  id: string;
  title: string;
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
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; email: string; avatar: string | null };
  campaign: { id: string; name: string } | null;
  approvals: Array<{
    id: string;
    status: string;
    comment: string | null;
    createdAt: string;
    revisionId: string;
    reviewer: { id: string; name: string | null };
  }>;
}

export interface QueueListResponse {
  items: QueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const FILTER_STATUS: Record<QueueFilter, string | undefined> = {
  all: 'all',
  pending: 'PENDING_REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
  draft: 'DRAFT',
};

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

export function useQueue(filter: QueueFilter = 'pending') {
  const status = FILTER_STATUS[filter];
  return useQuery<QueueListResponse>({
    queryKey: ['queue', filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (status) params.set('status', status);
      const res = await fetch(`/api/queue?${params}`);
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    refetchInterval: 20000,
  });
}

type DecisionBody = { revisionId: string; comment?: string };

function useDecisionMutation(path: (id: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contentId,
      revisionId,
      comment,
    }: {
      contentId: string;
      revisionId: string;
      comment?: string;
    }) => {
      const body: DecisionBody = { revisionId };
      if (comment !== undefined) body.comment = comment;
      const res = await fetch(path(contentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await parseApiError(res);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['content', vars.contentId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useApproveContent() {
  return useDecisionMutation((id) => `/api/queue/${id}/approve`);
}

export function useRejectContent() {
  return useDecisionMutation((id) => `/api/queue/${id}/reject`);
}

export function useRequestRevision() {
  return useDecisionMutation((id) => `/api/queue/${id}/request-revision`);
}
