// src/services/content.service.ts
import { prisma } from '@/lib/prisma';
import { guardianService } from '@/lib/guardian/guardian.service';
import type { Content, ContentType, Channel } from '@/types';

export class ContentService {
  async create(data: {
    title: string;
    body: string;
    type: ContentType;
    channel: Channel;
    authorId: string;
    campaignId?: string;
  }) {
    // Run Guardian check
    const guardianResult = await guardianService.checkContent(data.body, data.title);

    const content = await prisma.content.create({
      data: {
        ...data,
        guardianScore: guardianResult.score,
        guardianChecks: guardianResult.checks as any,
        guardianFlags: guardianResult.flags as any,
        status: guardianResult.score >= 95 ? 'APPROVED' : 'PENDING_REVIEW',
      },
      include: {
        author: true,
        approvals: { include: { reviewer: true } },
        campaign: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: data.authorId,
        type: 'CONTENT_CREATED',
        description: `Created ${data.type}: "${data.title}"`,
        metadata: { contentId: content.id, guardianScore: guardianResult.score },
      },
    });

    return content;
  }

  async update(id: string, data: Partial<Content>, userId: string) {
    const content = await prisma.content.findUnique({ where: { id } });
    if (!content) throw new Error('Content not found');

    // Re-run Guardian if body changed
    let guardianResult;
    if (data.body) {
      guardianResult = await guardianService.checkContent(data.body, data.title || content.title);
      data.guardianScore = guardianResult.score;
      data.guardianChecks = guardianResult.checks as any;
      data.guardianFlags = guardianResult.flags as any;
    }

    const updated = await prisma.content.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
      include: {
        author: true,
        approvals: { include: { reviewer: true } },
        campaign: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        type: 'CONTENT_UPDATED',
        description: `Updated content: "${updated.title}"`,
        metadata: { contentId: id },
      },
    });

    return updated;
  }

  async getById(id: string) {
    return prisma.content.findUnique({
      where: { id },
      include: {
        author: true,
        approvals: { include: { reviewer: true } },
        campaign: true,
      },
    });
  }

  async getAll(options: {
    status?: string;
    channel?: string;
    authorId?: string;
    campaignId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { status, channel, authorId, campaignId, page = 1, limit = 20 } = options;

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (authorId) where.authorId = authorId;
    if (campaignId) where.campaignId = campaignId;

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, avatar: true } },
          approvals: { include: { reviewer: { select: { id: true, name: true } } } },
          campaign: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async approve(id: string, reviewerId: string, comment?: string) {
    const content = await prisma.content.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { author: true },
    });

    await prisma.approval.create({
      data: {
        contentId: id,
        reviewerId,
        status: 'APPROVED',
        comment,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: reviewerId,
        type: 'CONTENT_APPROVED',
        description: `Approved: "${content.title}"`,
        metadata: { contentId: id },
      },
    });

    return content;
  }

  async reject(id: string, reviewerId: string, comment: string) {
    const content = await prisma.content.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { author: true },
    });

    await prisma.approval.create({
      data: {
        contentId: id,
        reviewerId,
        status: 'REJECTED',
        comment,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: reviewerId,
        type: 'CONTENT_REJECTED',
        description: `Rejected: "${content.title}" — ${comment}`,
        metadata: { contentId: id },
      },
    });

    return content;
  }

  async schedule(id: string, scheduledAt: Date) {
    return prisma.content.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt },
    });
  }

  async publish(id: string) {
    const content = await prisma.content.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
      include: { author: true },
    });

    await prisma.activityLog.create({
      data: {
        userId: content.authorId,
        type: 'CONTENT_PUBLISHED',
        description: `Published: "${content.title}" on ${content.channel}`,
        metadata: { contentId: id, channel: content.channel },
      },
    });

    return content;
  }

  async getDashboardStats() {
    const [
      pendingCount,
      scheduledCount,
      publishedThisWeek,
      activeAgents,
      guardianStats,
      attributionStats,
    ] = await Promise.all([
      prisma.content.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.content.count({ where: { status: 'SCHEDULED' } }),
      prisma.content.count({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.agent.count({ where: { status: 'ONLINE' } }),
      prisma.content.aggregate({
        where: { status: { in: ['APPROVED', 'PUBLISHED'] } },
        _avg: { guardianScore: true },
      }),
      prisma.content.aggregate({
        _sum: { signups: true, integrations: true, treasuryImpact: true },
      }),
    ]);

    return {
      pendingApprovals: pendingCount,
      scheduledPosts: scheduledCount,
      publishedThisEpoch: publishedThisWeek,
      activeAgents,
      guardianPassRate: Math.round((guardianStats._avg.guardianScore || 0)),
      contentToDevAttribution: attributionStats._sum.signups || 0,
    };
  }
}

export const contentService = new ContentService();
