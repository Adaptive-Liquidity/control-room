import type { OutboxEvent, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { deliverResume } from '@/lib/n8n/resume-client';
import type { N8nResumePayload } from '@/lib/n8n/contracts';

const BACKOFF_MS = [
  0,
  15_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
];

export const OUTBOX_TYPE_N8N_RESUME = 'N8N_RESUME_REQUESTED';

export class OutboxService {
  async enqueue(
    data: {
      type: string;
      aggregateId: string;
      payload: Prisma.InputJsonValue;
    },
    tx: Prisma.TransactionClient = prisma
  ) {
    return tx.outboxEvent.create({
      data: {
        type: data.type,
        aggregateId: data.aggregateId,
        payload: data.payload,
        status: 'PENDING',
        nextAttemptAt: new Date(),
      },
    });
  }

  async processOne(eventId: string): Promise<boolean> {
    const event = await prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event) return false;
    if (event.status === 'PROCESSED') return true;
    return this.deliver(event);
  }

  async processPending(limit = 20): Promise<{ processed: number; failed: number }> {
    const now = new Date();
    const events = await prisma.outboxEvent.findMany({
      where: {
        status: { in: ['PENDING', 'RETRY'] },
        nextAttemptAt: { lte: now },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });

    let processed = 0;
    let failed = 0;
    for (const event of events) {
      const ok = await this.deliver(event);
      if (ok) processed += 1;
      else failed += 1;
    }
    return { processed, failed };
  }

  private async deliver(event: OutboxEvent): Promise<boolean> {
    try {
      if (event.type === OUTBOX_TYPE_N8N_RESUME) {
        const payload = event.payload as {
          bridgeJobId: string;
          resume: N8nResumePayload;
        };
        const result = await deliverResume({
          bridgeJobId: payload.bridgeJobId,
          payload: payload.resume,
        });
        if (!result.ok) {
          await this.markRetryOrFailed(event, result.error ?? 'Resume delivery failed');
          return false;
        }
      } else {
        await this.markRetryOrFailed(event, `Unknown outbox type: ${event.type}`);
        return false;
      }

      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          lastError: null,
          attempts: { increment: 1 },
        },
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Outbox delivery error';
      await this.markRetryOrFailed(event, message);
      return false;
    }
  }

  private async markRetryOrFailed(event: OutboxEvent, error: string) {
    const attempts = event.attempts + 1;
    if (attempts >= BACKOFF_MS.length) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          attempts,
          lastError: error,
        },
      });
      return;
    }

    const delay = BACKOFF_MS[attempts] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'RETRY',
        attempts,
        lastError: error,
        nextAttemptAt: new Date(Date.now() + delay),
      },
    });
  }
}

export const outboxService = new OutboxService();
