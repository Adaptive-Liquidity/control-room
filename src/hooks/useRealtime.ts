'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { getPusherClient } from '@/lib/pusher/client';
import {
  AGENT_RUN_UPDATED_EVENT,
  CONTENT_REALTIME_EVENTS,
  CONTROL_ROOM_CHANNEL,
} from '@/lib/pusher/constants';

type ContentEventPayload = {
  contentId?: string;
  revisionId?: string;
  status?: string;
};

/**
 * Subscribes to private-control-room and invalidates React Query caches.
 * Safe no-op when unauthenticated or Pusher env is missing — polling remains.
 */
export function useRealtime() {
  const { status } = useSession();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status !== 'authenticated') return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(CONTROL_ROOM_CHANNEL);

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

    for (const event of CONTENT_REALTIME_EVENTS) {
      channel.bind(event, onContentEvent);
    }
    channel.bind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);

    return () => {
      for (const event of CONTENT_REALTIME_EVENTS) {
        channel.unbind(event, onContentEvent);
      }
      channel.unbind(AGENT_RUN_UPDATED_EVENT, onAgentRunUpdated);
      pusher.unsubscribe(CONTROL_ROOM_CHANNEL);
    };
  }, [status, queryClient]);
}
