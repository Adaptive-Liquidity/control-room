'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (status !== 'authenticated') return;

    const pusher = getPusherClient();
    if (!pusher) return;
    let cancelled = false;
    let channel: ReturnType<typeof pusher.subscribe> | null = null;
    let channelName: string | null = null;

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

    void fetch('/api/projects')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ activeProjectId?: string }>;
      })
      .then((data) => {
        if (cancelled || !data?.activeProjectId) return;
        channelName = projectChannel(data.activeProjectId);
        channel = pusher.subscribe(channelName);
        for (const event of CONTENT_REALTIME_EVENTS) {
          channel.bind(event, onContentEvent);
        }
        channel.bind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (!channel || !channelName) return;
      for (const event of CONTENT_REALTIME_EVENTS) {
        channel.unbind(event, onContentEvent);
      }
      channel.unbind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);
      pusher.unsubscribe(channelName);
    };
  }, [status, queryClient]);
}
