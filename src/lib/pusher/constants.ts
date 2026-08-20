/** Shared Pusher channel / event names (safe for client + server). */

/** @deprecated Prefer projectChannel(projectId) — global channel leaks across projects. */
export const CONTROL_ROOM_CHANNEL = 'private-control-room';

export function projectChannel(projectId: string): string {
  return `private-project-${projectId}`;
}

export function isProjectChannel(name: string): boolean {
  return /^private-project-[a-zA-Z0-9_-]+$/.test(name);
}

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
