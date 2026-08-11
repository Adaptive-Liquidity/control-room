// src/services/metrics.service.ts
import type { AttributionKind, Channel, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class MetricsService {
  async ingestSnapshot(payload: {
    eventId: string;
    contentId?: string;
    campaignId?: string;
    channel?: Channel;
    observedAt: string;
    impressions?: number;
    engagements?: number;
    clicks?: number;
    signups?: number;
    integrations?: number;
    reach?: number;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.metricSnapshot.findUnique({
      where: { eventId: payload.eventId },
    });
    if (existing) {
      return { snapshot: existing, idempotent: true };
    }

    const snapshot = await prisma.$transaction(async (tx) => {
      const created = await tx.metricSnapshot.create({
        data: {
          eventId: payload.eventId,
          contentId: payload.contentId,
          campaignId: payload.campaignId,
          channel: payload.channel,
          observedAt: new Date(payload.observedAt),
          impressions: payload.impressions ?? 0,
          engagements: payload.engagements ?? 0,
          clicks: payload.clicks ?? 0,
          signups: payload.signups ?? 0,
          integrations: payload.integrations ?? 0,
          reach: payload.reach,
          metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      if (payload.contentId) {
        await tx.content.update({
          where: { id: payload.contentId },
          data: {
            impressions: { increment: payload.impressions ?? 0 },
            engagements: { increment: payload.engagements ?? 0 },
            signups: { increment: payload.signups ?? 0 },
            integrations: { increment: payload.integrations ?? 0 },
          },
        });
      }

      if (payload.campaignId) {
        await tx.campaign.update({
          where: { id: payload.campaignId },
          data: {
            totalImpressions: { increment: payload.impressions ?? 0 },
            totalEngagements: { increment: payload.engagements ?? 0 },
            totalSignups: { increment: payload.signups ?? 0 },
            totalIntegrations: { increment: payload.integrations ?? 0 },
          },
        });
      }

      await tx.activityLog.create({
        data: {
          type: 'METRICS_INGESTED',
          description: `Metric snapshot ingested for ${payload.contentId ?? payload.campaignId ?? 'unknown'}`,
          metadata: { eventId: payload.eventId, snapshotId: created.id },
        },
      });

      return created;
    });

    return { snapshot, idempotent: false };
  }

  async ingestAttribution(payload: {
    eventId: string;
    kind: AttributionKind;
    contentId?: string;
    campaignId?: string;
    occurredAt: string;
    value?: number;
    currency?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.attributionEvent.findUnique({
      where: { eventId: payload.eventId },
    });
    if (existing) {
      return { event: existing, idempotent: true };
    }

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.attributionEvent.create({
        data: {
          eventId: payload.eventId,
          kind: payload.kind,
          contentId: payload.contentId,
          campaignId: payload.campaignId,
          occurredAt: new Date(payload.occurredAt),
          value: payload.value,
          currency: payload.currency,
          sessionId: payload.sessionId,
          metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      const contentInc: Prisma.ContentUpdateInput = {};
      const campaignInc: Prisma.CampaignUpdateInput = {};

      if (payload.kind === 'VIEW') {
        contentInc.impressions = { increment: 1 };
        campaignInc.totalImpressions = { increment: 1 };
      } else if (payload.kind === 'CLICK') {
        contentInc.engagements = { increment: 1 };
        campaignInc.totalEngagements = { increment: 1 };
      } else if (payload.kind === 'SIGNUP' || payload.kind === 'ACTIVATION') {
        contentInc.signups = { increment: 1 };
        campaignInc.totalSignups = { increment: 1 };
      } else if (payload.kind === 'INTEGRATION') {
        contentInc.integrations = { increment: 1 };
        campaignInc.totalIntegrations = { increment: 1 };
      } else if (payload.kind === 'TREASURY' && payload.value != null) {
        contentInc.treasuryImpact = { increment: payload.value };
      }

      if (payload.contentId && Object.keys(contentInc).length) {
        await tx.content.update({ where: { id: payload.contentId }, data: contentInc });
      }
      if (payload.campaignId && Object.keys(campaignInc).length) {
        await tx.campaign.update({ where: { id: payload.campaignId }, data: campaignInc });
      }

      return created;
    });

    return { event, idempotent: false };
  }

  async getAnalytics(opts: { days?: number } = {}) {
    const days = opts.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, contents, approvals] = await Promise.all([
      prisma.metricSnapshot.findMany({
        where: { observedAt: { gte: since } },
      }),
      prisma.content.findMany({
        where: { createdAt: { gte: since } },
        select: {
          id: true,
          title: true,
          channel: true,
          status: true,
          impressions: true,
          engagements: true,
          signups: true,
        },
      }),
      prisma.approval.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: true,
      }),
    ]);

    const totals = snapshots.reduce(
      (acc, s) => ({
        impressions: acc.impressions + s.impressions,
        engagements: acc.engagements + s.engagements,
        clicks: acc.clicks + s.clicks,
        signups: acc.signups + s.signups,
        integrations: acc.integrations + s.integrations,
      }),
      { impressions: 0, engagements: 0, clicks: 0, signups: 0, integrations: 0 }
    );

    // Fall back to content cache counters when no snapshots yet
    const contentTotals = contents.reduce(
      (acc, c) => ({
        impressions: acc.impressions + c.impressions,
        engagements: acc.engagements + c.engagements,
        signups: acc.signups + c.signups,
      }),
      { impressions: 0, engagements: 0, signups: 0 }
    );

    const impressions = totals.impressions || contentTotals.impressions;
    const engagements = totals.engagements || contentTotals.engagements;
    const signups = totals.signups || contentTotals.signups;

    const approved = approvals.find((a) => a.status === 'APPROVED')?._count ?? 0;
    const rejected = approvals.find((a) => a.status === 'REJECTED')?._count ?? 0;
    const approvalDenom = approved + rejected;
    const approvalRate = approvalDenom ? Math.round((approved / approvalDenom) * 100) : null;

    const byChannel = (['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG'] as Channel[]).map(
      (channel) => {
        const pieces = contents.filter((c) => c.channel === channel);
        const channelSnaps = snapshots.filter((s) => s.channel === channel);
        const chImp =
          channelSnaps.reduce((s, x) => s + x.impressions, 0) ||
          pieces.reduce((s, x) => s + x.impressions, 0);
        const chEng =
          channelSnaps.reduce((s, x) => s + x.engagements, 0) ||
          pieces.reduce((s, x) => s + x.engagements, 0);
        const chSignups =
          channelSnaps.reduce((s, x) => s + x.signups, 0) ||
          pieces.reduce((s, x) => s + x.signups, 0);
        const top = [...pieces].sort((a, b) => b.impressions - a.impressions)[0];
        return {
          channel,
          pieces: pieces.length,
          impressions: chImp,
          engagementRate: chImp ? Math.round((chEng / chImp) * 1000) / 10 : 0,
          signups: chSignups,
          topPerformer: top?.title ?? null,
        };
      }
    );

    return {
      windowDays: days,
      stats: {
        totalImpressions: impressions,
        engagementRate: impressions ? Math.round((engagements / impressions) * 1000) / 10 : 0,
        contentPieces: contents.length,
        approvalRate,
        signups,
        integrations: totals.integrations,
      },
      channels: byChannel,
      snapshotCount: snapshots.length,
    };
  }

  async getAttribution(opts: { days?: number } = {}) {
    const days = opts.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await prisma.attributionEvent.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { occurredAt: 'desc' },
      take: 5000,
    });

    const views = events.filter((e) => e.kind === 'VIEW').length;
    const clicks = events.filter((e) => e.kind === 'CLICK').length;
    const signups = events.filter((e) => e.kind === 'SIGNUP' || e.kind === 'ACTIVATION').length;
    const integrations = events.filter((e) => e.kind === 'INTEGRATION').length;

    const byContent = new Map<
      string,
      { views: number; signups: number; integrations: number; treasury: number }
    >();
    for (const e of events) {
      if (!e.contentId) continue;
      const row = byContent.get(e.contentId) ?? {
        views: 0,
        signups: 0,
        integrations: 0,
        treasury: 0,
      };
      if (e.kind === 'VIEW') row.views += 1;
      if (e.kind === 'SIGNUP' || e.kind === 'ACTIVATION') row.signups += 1;
      if (e.kind === 'INTEGRATION') row.integrations += 1;
      if (e.kind === 'TREASURY') row.treasury += e.value ?? 0;
      byContent.set(e.contentId, row);
    }

    const contentIds: string[] = [];
    byContent.forEach((_row, contentId) => {
      contentIds.push(contentId);
    });
    const contents = contentIds.length
      ? await prisma.content.findMany({
          where: { id: { in: contentIds } },
          select: { id: true, title: true, impressions: true, signups: true, integrations: true, treasuryImpact: true },
        })
      : [];
    const titleById = new Map(contents.map((c) => [c.id, c]));

    const rows: Array<{
      contentId: string;
      content: string;
      views: number;
      signups: number;
      integrations: number;
      treasuryImpact: number;
      roi: number | null;
    }> = [];
    byContent.forEach((row, contentId) => {
      const c = titleById.get(contentId);
      const viewsCount = row.views || c?.impressions || 0;
      const signupCount = row.signups || c?.signups || 0;
      const integrationCount = row.integrations || c?.integrations || 0;
      const impact = row.treasury || c?.treasuryImpact || 0;
      rows.push({
        contentId,
        content: c?.title ?? contentId,
        views: viewsCount,
        signups: signupCount,
        integrations: integrationCount,
        treasuryImpact: impact,
        roi:
          impact > 0 && viewsCount > 0
            ? Math.round((impact / Math.max(viewsCount, 1)) * 100) / 100
            : null,
      });
    });
    rows.sort((a, b) => b.signups - a.signups);
    const topRows = rows.slice(0, 50);

    // If no attribution events, fall back to content cache counters
    const fallbackRows =
      topRows.length === 0
        ? (
            await prisma.content.findMany({
              where: { OR: [{ signups: { gt: 0 } }, { impressions: { gt: 0 } }] },
              orderBy: { signups: 'desc' },
              take: 20,
              select: {
                id: true,
                title: true,
                impressions: true,
                signups: true,
                integrations: true,
                treasuryImpact: true,
              },
            })
          ).map((c) => ({
            contentId: c.id,
            content: c.title,
            views: c.impressions,
            signups: c.signups,
            integrations: c.integrations,
            treasuryImpact: c.treasuryImpact,
            roi: null as number | null,
          }))
        : topRows;

    return {
      windowDays: days,
      stats: {
        contentToSignupRate: views ? Math.round((signups / views) * 1000) / 10 : null,
        signupToIntegrationRate: signups ? Math.round((integrations / signups) * 1000) / 10 : null,
        views,
        clicks,
        signups,
        integrations,
        eventCount: events.length,
      },
      rows: fallbackRows,
    };
  }
}

export const metricsService = new MetricsService();
