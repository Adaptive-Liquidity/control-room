/** Shared Pusher channel / event names (safe for client + server). */

export const CONTROL_ROOM_CHANNEL = 'private-control-room';

export const CONTENT_REALTIME_EVENTS = [
  'content.created',
  'content.updated',
  'content.approved',
  'content.rejected',
  'content.published',
] as const;

export const AGENT_RUN_UPDATED_EVENT = 'agent.run.updated' as const;

export type ControlRoomEvent =
  | (typeof CONTENT_REALTIME_EVENTS)[number]
  | typeof AGENT_RUN_UPDATED_EVENT;
