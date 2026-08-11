import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';

const MAX_SKEW_MS = 5 * 60 * 1000;

export class SignatureError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'SignatureError';
  }
}

export function verifyN8nHmac(opts: {
  secret: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
}): void {
  const { secret, timestampHeader, signatureHeader, rawBody } = opts;

  if (!secret) {
    throw new SignatureError('Ingress secret is not configured');
  }
  if (!timestampHeader || !signatureHeader) {
    throw new SignatureError('Missing signature headers');
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    throw new SignatureError('Invalid timestamp');
  }

  // Support seconds or milliseconds epoch.
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) {
    throw new SignatureError('Timestamp outside allowed skew');
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new SignatureError('Invalid signature');
  }
}

/** Reject already-consumed event ids across ingress tables. */
export async function assertEventIdUnused(eventId: string): Promise<void> {
  const [bridge, receipt, agentRun, metric, attribution] = await Promise.all([
    prisma.n8nBridgeJob.findUnique({ where: { eventId }, select: { id: true } }),
    prisma.publishReceipt.findUnique({ where: { eventId }, select: { id: true } }),
    prisma.agentRun.findUnique({ where: { eventId }, select: { id: true } }),
    prisma.metricSnapshot.findUnique({ where: { eventId }, select: { id: true } }),
    prisma.attributionEvent.findUnique({ where: { eventId }, select: { id: true } }),
  ]);
  if (bridge || receipt || agentRun || metric || attribution) {
    throw new SignatureError('eventId already consumed');
  }
}
