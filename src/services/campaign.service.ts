// src/services/campaign.service.ts
import type { AudienceTier, CampaignStatus, CampaignTheme, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { scopedPrisma } from '@/lib/scope/scoped-prisma';

export class CampaignServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'CampaignServiceError';
    this.statusCode = statusCode;
  }
}

export class CampaignService {
  async getAll(options: {
    status?: CampaignStatus | string;
    page?: number;
    limit?: number;
    projectId: string;
  }) {
    const { status, page = 1, limit = 20, projectId } = options;
    const where: { status?: CampaignStatus; projectId?: string } = {};
    if (status) where.status = status as CampaignStatus;
    where.projectId = projectId;

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          contents: { select: { id: true, status: true, channel: true, scheduledAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    const enriched = items.map((c) => ({
      ...c,
      pieceCount: c.contents.length,
      scheduledCount: c.contents.filter((x) => x.status === 'SCHEDULED' || x.scheduledAt).length,
    }));

    return { items: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: string, projectId: string) {
    return scopedPrisma(projectId, prisma).campaign.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        contents: {
          select: { id: true, title: true, status: true, channel: true, scheduledAt: true },
        },
      },
    });
  }

  async create(data: {
    name: string;
    theme: CampaignTheme;
    audience: AudienceTier;
    startDate: Date | string;
    endDate?: Date | string;
    budget?: number;
    objective?: string;
    thesis?: string;
    approvalPolicy?: Record<string, unknown>;
    dailyContentLimit?: number;
    dailyPublishLimit?: number;
    creatorId: string;
    projectId: string;
  }) {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        theme: data.theme,
        audience: data.audience,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        budget: data.budget,
        objective: data.objective,
        thesis: data.thesis,
        approvalPolicy: (data.approvalPolicy ?? undefined) as Prisma.InputJsonValue | undefined,
        dailyContentLimit: data.dailyContentLimit,
        dailyPublishLimit: data.dailyPublishLimit,
        creatorId: data.creatorId,
        projectId: data.projectId,
      },
      include: {
        creator: true,
        contents: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: data.creatorId,
        projectId: data.projectId,
        type: 'CAMPAIGN_LAUNCHED',
        description: `Launched campaign: "${data.name}"`,
        metadata: { campaignId: campaign.id },
      },
    });

    return campaign;
  }

  async setPaused(id: string, paused: boolean, userId: string, projectId: string) {
    const db = scopedPrisma(projectId, prisma);
    const campaign = await db.campaign.update({
      where: { id },
      data: {
        paused,
        status: paused ? 'PAUSED' : 'ACTIVE',
      },
    });
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        type: 'CAMPAIGN_PAUSED',
        description: paused
          ? `Paused campaign: "${campaign.name}"`
          : `Resumed campaign: "${campaign.name}"`,
        metadata: { campaignId: id, paused },
      },
    });
    return campaign;
  }

  async setAutoGenDisabled(id: string, disabled: boolean, userId: string, projectId: string) {
    const db = scopedPrisma(projectId, prisma);
    const campaign = await db.campaign.update({
      where: { id },
      data: { autoGenDisabled: disabled },
    });
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        type: 'CAMPAIGN_PAUSED',
        description: disabled
          ? `Disabled auto-gen for campaign: "${campaign.name}"`
          : `Enabled auto-gen for campaign: "${campaign.name}"`,
        metadata: { campaignId: id, autoGenDisabled: disabled },
      },
    });
    return campaign;
  }

  async emergencyStop(id: string, userId: string, projectId: string) {
    const db = scopedPrisma(projectId, prisma);
    const campaign = await db.campaign.update({
      where: { id },
      data: {
        emergencyStopped: true,
        paused: true,
        autoGenDisabled: true,
        status: 'PAUSED',
      },
    });
    await db.activityLog.create({
      data: {
        userId,
        projectId,
        type: 'CAMPAIGN_STOPPED',
        description: `Emergency stop: "${campaign.name}"`,
        metadata: { campaignId: id },
      },
    });
    return campaign;
  }

  async updateAttribution(campaignId: string, projectId: string) {
    const contents = await prisma.content.findMany({
      where: { campaignId, projectId },
    });

    const totals = contents.reduce(
      (acc, c) => ({
        impressions: acc.impressions + c.impressions,
        engagements: acc.engagements + c.engagements,
        signups: acc.signups + c.signups,
        integrations: acc.integrations + c.integrations,
      }),
      { impressions: 0, engagements: 0, signups: 0, integrations: 0 }
    );

    return prisma.campaign.update({
      where: { id: campaignId, projectId },
      data: {
        totalImpressions: totals.impressions,
        totalEngagements: totals.engagements,
        totalSignups: totals.signups,
        totalIntegrations: totals.integrations,
      },
    });
  }
}

export const campaignService = new CampaignService();
