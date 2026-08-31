'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { getPusherClient } from '@/lib/pusher/client';
import {
  AGENT_RUN_UPDATED_EVENT,
  CONTENT_REALTIME_EVENTS,
  projectChannel,
} from '@/lib/pusher/constants';

type ContentEventPayload = {
  contentId?: string;
  revisionId?: string;
  status?: string;
};

/**
 * Subscribes to the active project's private channel and invalidates React Query caches.
 * Safe no-op when unauthenticated or Pusher env is missing — polling remains.
 */
export function useRealtime() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') {
      setActiveProjectId(null);
      return;
    }
    let cancelled = false;
    void fetch('/api/projects')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ activeProjectId?: string }>;
      })
      .then((data) => {
        if (cancelled) return;
        setActiveProjectId(data?.activeProjectId ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated' || !activeProjectId) return;

    const pusher = getPusherClient();
    if (!pusher) return;
    let channel: ReturnType<typeof pusher.subscribe> | null = null;
    const channelName = projectChannel(activeProjectId);

    const onContentEvent = (data: ContentEventPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (data?.contentId) {
        void queryClient.invalidateQueries({
          queryKey: ['content', data.contentId],
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['content'] });
      }
    };

    const onAgentRunUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    channel = pusher.subscribe(channelName);
    for (const event of CONTENT_REALTIME_EVENTS) {
      channel.bind(event, onContentEvent);
    }
    channel.bind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);

    return () => {
      if (!channel) return;
      for (const event of CONTENT_REALTIME_EVENTS) {
        channel.unbind(event, onContentEvent);
      }
      channel.unbind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);
      pusher.unsubscribe(channelName);
    };
  }, [status, queryClient, activeProjectId]);
}
