// src/services/health.service.ts
import { prisma } from '@/lib/prisma';
import { isStorageConfigured } from '@/lib/firebase/admin';

function flag(configured: boolean, detail?: string) {
  return { configured, ...(detail ? { detail } : {}) };
}

export class HealthService {
  async getIntegrationHealth() {
    const now = new Date();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      lastBridge,
      lastReceipt,
      lastAgentRun,
      lastMetric,
      outboxPending,
      outboxRetry,
      outboxFailed,
      recentIngressCount,
    ] = await Promise.all([
      prisma.n8nBridgeJob.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.publishReceipt.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.agentRun.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.metricSnapshot.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
      prisma.outboxEvent.count({ where: { status: 'RETRY' } }),
      prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
      prisma.n8nBridgeJob.count({ where: { createdAt: { gte: dayAgo } } }),
    ]);

    const n8nIngressConfigured = Boolean(process.env.N8N_INGRESS_SECRET);
    const n8nResumeConfigured = Boolean(process.env.N8N_RESUME_SECRET);
    const n8nBridgeKeyConfigured = Boolean(process.env.N8N_BRIDGE_ENCRYPTION_KEY);
    const cronConfigured = Boolean(process.env.CRON_SECRET);
    const pusherConfigured = Boolean(
      process.env.PUSHER_APP_ID &&
        process.env.PUSHER_KEY &&
        process.env.PUSHER_SECRET &&
        process.env.PUSHER_CLUSTER
    );
    const storageConfigured = isStorageConfigured();

    return {
      checkedAt: now.toISOString(),
      n8n: {
        ingressSecret: flag(n8nIngressConfigured),
        resumeSecret: flag(n8nResumeConfigured),
        bridgeEncryptionKey: flag(n8nBridgeKeyConfigured),
        lastDraftIngressAt: lastBridge?.createdAt?.toISOString() ?? null,
        lastPublishReceiptAt: lastReceipt?.createdAt?.toISOString() ?? null,
        lastAgentRunAt: lastAgentRun?.createdAt?.toISOString() ?? null,
        lastMetricIngestAt: lastMetric?.createdAt?.toISOString() ?? null,
        draftsLast24h: recentIngressCount,
      },
      outbox: {
        pending: outboxPending,
        retry: outboxRetry,
        failed: outboxFailed,
        cronSecret: flag(cronConfigured),
      },
      pusher: flag(pusherConfigured, pusherConfigured ? 'env present' : 'env missing'),
      storage: flag(storageConfigured, storageConfigured ? 'bucket configured' : 'bucket/credentials missing'),
      // Never include secret values
    };
  }
}

export const healthService = new HealthService();
