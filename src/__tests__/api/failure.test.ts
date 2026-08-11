/**
 * Failure modes: n8n down → outbox RETRY; Pusher down → mutations still succeed.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    outboxEvent: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    n8nBridgeJob: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/n8n/resume-client', () => ({
  deliverResume: jest.fn(),
}));

import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { deliverResume } from '@/lib/n8n/resume-client';
import { OutboxService, OUTBOX_TYPE_N8N_RESUME } from '@/lib/outbox/outbox.service';
import { emitContentApproved, triggerControlRoom } from '@/lib/pusher/server';

const mockedPrisma = prisma as unknown as {
  outboxEvent: { findUnique: jest.Mock; update: jest.Mock };
};

describe('failure: n8n down → outbox RETRY', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks outbox RETRY when resume delivery fails', async () => {
    const event = {
      id: 'ob1',
      type: OUTBOX_TYPE_N8N_RESUME,
      status: 'PENDING',
      attempts: 0,
      payload: {
        bridgeJobId: 'bj1',
        resume: { schemaVersion: '1', decision: 'APPROVED' },
      },
    };
    mockedPrisma.outboxEvent.findUnique.mockResolvedValue(event);
    mockedPrisma.outboxEvent.update.mockResolvedValue({});
    (deliverResume as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'fetch failed: ECONNREFUSED',
    });

    const svc = new OutboxService();
    const ok = await svc.processOne('ob1');
    expect(ok).toBe(false);
    expect(mockedPrisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ob1' },
        data: expect.objectContaining({
          status: 'RETRY',
          attempts: 1,
          lastError: expect.stringContaining('ECONNREFUSED'),
        }),
      })
    );
  });
});

describe('failure: Pusher down → UI still works', () => {
  it('emit helpers resolve when Pusher env is missing (jest setup)', async () => {
    // PUSHER_* unset in jest.setup → getPusherServer() is null → no-op
    await expect(
      emitContentApproved({
        contentId: 'c1',
        revisionId: 'r1',
        status: 'APPROVED',
      })
    ).resolves.toBeUndefined();
    await expect(
      triggerControlRoom('content.updated', { contentId: 'c1' })
    ).resolves.toBeUndefined();
  });

  it('triggerControlRoom wraps client.trigger in try/catch (source contract)', () => {
    const source = readFileSync(join(__dirname, '../../lib/pusher/server.ts'), 'utf8');
    expect(source).toMatch(/try\s*\{[\s\S]*client\.trigger[\s\S]*\}\s*catch/);
    expect(source).toMatch(/Never throws/);
  });

  it('queue polling interval remains defined without Pusher', () => {
    const source = readFileSync(join(__dirname, '../../hooks/useQueue.ts'), 'utf8');
    expect(source).toMatch(/refetchInterval:\s*20000/);
  });
});
