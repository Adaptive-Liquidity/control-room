import Pusher from 'pusher';
import {
  AGENT_RUN_UPDATED_EVENT,
  projectChannel,
  type ControlRoomEvent,
} from '@/lib/pusher/constants';

export {
  AGENT_RUN_UPDATED_EVENT,
  CONTROL_ROOM_CHANNEL,
  CONTENT_REALTIME_EVENTS,
  projectChannel,
  type ControlRoomEvent,
} from '@/lib/pusher/constants';

/** IDs-only payloads — never bodies, resume URLs, or PII. */
export type ContentRealtimePayload = {
  contentId: string;
  projectId: string;
  revisionId?: string;
  status?: string;
};

export type AgentRunRealtimePayload = {
  agentRunId: string;
  projectId: string;
  agentId?: string;
  status?: string;
};

const ALLOWED_PAYLOAD_KEYS = new Set([
  'contentId',
  'revisionId',
  'status',
  'agentRunId',
  'agentId',
  'projectId',
]);

let pusherSingleton: Pusher | null | undefined;

function isConfigured(): boolean {
  return Boolean(
    process.env.PUSHER_APP_ID &&
      process.env.PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.PUSHER_CLUSTER
  );
}

/** Lazy server Pusher client; null when env is incomplete (local/dev without Pusher). */
export function getPusherServer(): Pusher | null {
  if (pusherSingleton !== undefined) return pusherSingleton;
  if (!isConfigured()) {
    pusherSingleton = null;
    return null;
  }
  pusherSingleton = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS: true,
  });
  return pusherSingleton;
}

function sanitizeIdsOnly(
  data: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!ALLOWED_PAYLOAD_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Best-effort trigger. Never throws — Pusher outage must not break mutations.
 * Always publishes to the tenant-specific private project channel.
 */
export async function triggerControlRoom(
  event: ControlRoomEvent,
  data: ContentRealtimePayload | AgentRunRealtimePayload
): Promise<void> {
  const client = getPusherServer();
  if (!client) return;

  const payload = sanitizeIdsOnly(data as unknown as Record<string, unknown>);
  if (!payload.contentId && !payload.agentRunId) return;

  if (!payload.projectId) return;
  const channel = projectChannel(payload.projectId);

  try {
    await client.trigger(channel, event, payload);
  } catch (err) {
    console.error(`Pusher trigger failed (${event}):`, err);
  }
}

export async function emitContentCreated(
  payload: ContentRealtimePayload
): Promise<void> {
  await triggerControlRoom('content.created', payload);
}

export async function emitContentUpdated(
  payload: ContentRealtimePayload
): Promise<void> {
  await triggerControlRoom('content.updated', payload);
}

export async function emitContentApproved(
  payload: ContentRealtimePayload
): Promise<void> {
  await triggerControlRoom('content.approved', payload);
}

export async function emitContentRejected(
  payload: ContentRealtimePayload
): Promise<void> {
  await triggerControlRoom('content.rejected', payload);
}

export async function emitContentPublished(
  payload: ContentRealtimePayload
): Promise<void> {
  await triggerControlRoom('content.published', payload);
}

export async function emitAgentRunUpdated(
  payload: AgentRunRealtimePayload
): Promise<void> {
  await triggerControlRoom(AGENT_RUN_UPDATED_EVENT, payload);
}
