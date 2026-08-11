'use client';

import PusherClient from 'pusher-js';

let clientSingleton: PusherClient | null | undefined;

/**
 * Browser Pusher client authorized via POST /api/pusher/auth.
 * Returns null when public env vars are missing (polling remains the fallback).
 */
export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null;
  if (clientSingleton !== undefined) return clientSingleton;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    clientSingleton = null;
    return null;
  }

  clientSingleton = new PusherClient(key, {
    cluster,
    authEndpoint: '/api/pusher/auth',
  });
  return clientSingleton;
}
