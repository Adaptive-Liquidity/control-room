// src/services/campaign.service.ts
import type { AudienceTier, CampaignStatus, CampaignTheme } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class CampaignService {
  async getAll(options: { status?: CampaignStatus | string; page?: number; limit?: number } = {}) {
    const { status, page = 1, limit = 20 } = options;
    const where: { status?: CampaignStatus } = {};
    if (status) where.status = status as CampaignStatus;

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          contents: { select: { id: true, status: true, channel: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: {
    name: string;
    theme: CampaignTheme;
    audience: AudienceTier;
    startDate: Date;
    endDate?: Date;
    budget?: number;
    creatorId: string;
  }) {
    const campaign = await prisma.campaign.create({
      data,
      include: {
        creator: true,
        contents: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: data.creatorId,
        type: 'CAMPAIGN_LAUNCHED',
        description: `Launched campaign: "${data.name}"`,
        metadata: { campaignId: campaign.id },
      },
    });

    return campaign;
  }

  async updateAttribution(campaignId: string) {
    const contents = await prisma.content.findMany({
      where: { campaignId },
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
      where: { id: campaignId },
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
