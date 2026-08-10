import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import type { N8nResumePayload } from './contracts';

export async function deliverResume(opts: {
  bridgeJobId: string;
  payload: N8nResumePayload;
}): Promise<{ ok: boolean; error?: string }> {
  const job = await prisma.n8nBridgeJob.findUnique({ where: { id: opts.bridgeJobId } });
  if (!job) return { ok: false, error: 'Bridge job not found' };

  if (job.resumeExpiresAt && job.resumeExpiresAt.getTime() < Date.now()) {
    await prisma.n8nBridgeJob.update({
      where: { id: job.id },
      data: { resumeStatus: 'EXPIRED', lastError: 'Resume URL expired', lastAttemptAt: new Date() },
    });
    return { ok: false, error: 'Resume URL expired' };
  }

  const secret = process.env.N8N_RESUME_SECRET;
  if (!secret) {
    return { ok: false, error: 'N8N_RESUME_SECRET is not set' };
  }

  let resumeUrl: string;
  try {
    resumeUrl = decrypt(job.resumeUrlEncrypted);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Decrypt failed';
    await prisma.n8nBridgeJob.update({
      where: { id: job.id },
      data: {
        resumeStatus: 'FAILED',
        lastError: message,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    return { ok: false, error: message };
  }

  const body = JSON.stringify(opts.payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  try {
    const res = await fetch(resumeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Timestamp': timestamp,
        'X-N8N-Signature': signature,
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const error = `Resume HTTP ${res.status}: ${text.slice(0, 500)}`;
      await prisma.n8nBridgeJob.update({
        where: { id: job.id },
        data: {
          resumeStatus: 'FAILED',
          lastError: error,
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });
      return { ok: false, error };
    }

    await prisma.n8nBridgeJob.update({
      where: { id: job.id },
      data: {
        resumeStatus: 'DELIVERED',
        lastError: null,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Resume delivery failed';
    await prisma.n8nBridgeJob.update({
      where: { id: job.id },
      data: {
        resumeStatus: 'FAILED',
        lastError: error,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });
    return { ok: false, error };
  }
}
