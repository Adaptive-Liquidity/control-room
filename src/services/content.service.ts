// src/services/content.service.ts
import { createHash } from 'crypto';
import type { Channel, ContentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardianService } from '@/lib/guardian/guardian.service';
import {
  emitContentCreated,
  emitContentUpdated,
} from '@/lib/pusher/server';
import type { Content } from '@/types';

export class ConflictError extends Error {
  statusCode = 409;
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class ValidationServiceError extends Error {
  statusCode = 422;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationServiceError';
  }
}

export function hashContent(title: string, body: string): string {
  return createHash('sha256').update(`${title}\n${body}`).digest('hex');
}

export class ContentService {
  async createRevision(
    contentId: string,
    data: {
      title: string;
      body: string;
      channel: Channel;
      type: ContentType;
    },
    createdById: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    const last = await tx.contentRevision.findFirst({
      where: { contentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    const contentHash = hashContent(data.title, data.body);
    const guardianResult = await guardianService.checkContent(data.body, data.title);

    const revision = await tx.contentRevision.create({
      data: {
        contentId,
        version,
        title: data.title,
        body: data.body,
        channel: data.channel,
        type: data.type,
        contentHash,
        guardianPolicyVersion: guardianResult.policyVersion,
        guardianScore: guardianResult.score,
        guardianResult: guardianResult.result,
        guardianChecks: guardianResult.checks as unknown as Prisma.InputJsonValue,
        guardianFlags: guardianResult.flags as unknown as Prisma.InputJsonValue,
        createdById,
      },
    });

    await tx.content.update({
      where: { id: contentId },
      data: {
        title: data.title,
        body: data.body,
        channel: data.channel,
        type: data.type,
        version,
        currentRevisionId: revision.id,
        guardianScore: guardianResult.score,
        guardianChecks: guardianResult.checks as unknown as Prisma.InputJsonValue,
        guardianFlags: guardianResult.flags as unknown as Prisma.InputJsonValue,
      },
    });

    return { revision, guardianResult };
  }

  async create(data: {
    title: string;
    body: string;
    type: ContentType;
    channel: Channel;
    authorId: string;
    campaignId?: string;
    origin?: 'MANUAL' | 'N8N';
    externalDraftId?: string;
    n8nWorkflowId?: string;
    n8nExecutionId?: string;
    status?: Content['status'];
  }) {
    const content = await prisma.$transaction(async (tx) => {
      const created = await tx.content.create({
        data: {
          title: data.title,
          body: data.body,
          type: data.type,
          channel: data.channel,
          authorId: data.authorId,
          campaignId: data.campaignId,
          origin: data.origin ?? 'MANUAL',
          externalDraftId: data.externalDraftId,
          n8nWorkflowId: data.n8nWorkflowId,
          n8nExecutionId: data.n8nExecutionId,
          // Guardian never auto-approves; start in review (or explicit status).
          status: data.status ?? 'PENDING_REVIEW',
        },
      });

      const { revision, guardianResult } = await this.createRevision(
        created.id,
        {
          title: data.title,
          body: data.body,
          channel: data.channel,
          type: data.type,
        },
        data.authorId,
        tx
      );

      await tx.activityLog.create({
        data: {
          userId: data.authorId,
          type: 'CONTENT_CREATED',
          description: `Created ${data.type}: "${data.title}"`,
          metadata: {
            contentId: created.id,
            revisionId: revision.id,
            guardianScore: guardianResult.score,
            guardianResult: guardianResult.result,
          },
        },
      });

      return tx.content.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          author: true,
          approvals: { include: { reviewer: true } },
          campaign: true,
          revisions: { orderBy: { version: 'desc' }, take: 1 },
        },
      });
    });

    await emitContentCreated({
      contentId: content.id,
      revisionId: content.currentRevisionId ?? undefined,
      status: content.status,
    });

    return content;
  }

  async update(
    id: string,
    data: {
      title?: string;
      body?: string;
      type?: ContentType;
      channel?: Channel;
      campaignId?: string | null;
      status?: Content['status'];
      scheduledAt?: Date | null;
    },
    userId: string
  ) {
    const content = await prisma.content.findUnique({ where: { id } });
    if (!content) throw new Error('Content not found');

    const contentFieldsChanged =
      data.title !== undefined ||
      data.body !== undefined ||
      data.type !== undefined ||
      data.channel !== undefined;

    if (contentFieldsChanged) {
      await this.createRevision(
        id,
        {
          title: data.title ?? content.title,
          body: data.body ?? content.body,
          type: data.type ?? content.type,
          channel: data.channel ?? content.channel,
        },
        userId
      );
    }

    const updateData: Prisma.ContentUpdateInput = {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
      ...(data.campaignId !== undefined
        ? data.campaignId === null
          ? { campaign: { disconnect: true } }
          : { campaign: { connect: { id: data.campaignId } } }
        : {}),
    };

    const updated = await prisma.content.update({
      where: { id },
      data: updateData,
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

    await emitContentUpdated({
      contentId: updated.id,
      revisionId: updated.currentRevisionId ?? undefined,
      status: updated.status,
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
        revisions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });
  }

  /**
   * Detail payload for Queue/Studio: content + current/prior revisions (diff),
   * approvals, and Guardian snapshot from the current revision.
   */
  async getDetail(id: string) {
    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatar: true, role: true },
        },
        campaign: { select: { id: true, name: true } },
        approvals: {
          include: {
            reviewer: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!content) return null;

    const revisionInclude = {
      createdBy: { select: { id: true, name: true, email: true } },
    } as const;

    let currentRevision = content.currentRevisionId
      ? await prisma.contentRevision.findUnique({
          where: { id: content.currentRevisionId },
          include: revisionInclude,
        })
      : null;

    if (!currentRevision) {
      currentRevision = await prisma.contentRevision.findFirst({
        where: { contentId: id },
        orderBy: { version: 'desc' },
        include: revisionInclude,
      });
    }

    const priorRevision = currentRevision
      ? await prisma.contentRevision.findFirst({
          where: {
            contentId: id,
            version: { lt: currentRevision.version },
          },
          orderBy: { version: 'desc' },
          include: revisionInclude,
        })
      : null;

    const { approvals, ...contentFields } = content;

    return {
      content: contentFields,
      currentRevision,
      priorRevision,
      approvals,
      guardian: currentRevision
        ? {
            policyVersion: currentRevision.guardianPolicyVersion,
            score: currentRevision.guardianScore,
            result: currentRevision.guardianResult,
            checks: currentRevision.guardianChecks,
            flags: currentRevision.guardianFlags,
          }
        : null,
    };
  }

  async getAll(
    options: {
      status?: string;
      channel?: string;
      authorId?: string;
      campaignId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { status, channel, authorId, campaignId, page = 1, limit = 20 } = options;

    const where: Prisma.ContentWhereInput = {};
    if (status) where.status = status as Content['status'];
    if (channel) where.channel = channel as Channel;
    if (authorId) where.authorId = authorId;
    if (campaignId) where.campaignId = campaignId;

    const [items, total] = await Promise.all([
      prisma.content.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          channel: true,
          currentRevisionId: true,
          riskTier: true,
          origin: true,
          guardianScore: true,
          guardianChecks: true,
          guardianFlags: true,
          version: true,
          scheduledAt: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true, email: true, avatar: true } },
          campaign: { select: { id: true, name: true } },
          approvals: {
            select: {
              id: true,
              status: true,
              comment: true,
              createdAt: true,
              revisionId: true,
              reviewer: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.content.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** @deprecated Use approvalService.decide — kept only for non-revision transitional callers. */
  async approve(_id: string, _reviewerId: string, _comment?: string) {
    throw new Error(
      'contentService.approve is disabled. Use approvalService.decide with revisionId.'
    );
  }

  /** @deprecated Use approvalService.decide */
  async reject(_id: string, _reviewerId: string, _comment: string) {
    throw new Error(
      'contentService.reject is disabled. Use approvalService.decide with revisionId.'
    );
  }

  async schedule(id: string, scheduledAt: Date) {
    const existing = await prisma.content.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Content not found');
    }
    if (existing.status !== 'APPROVED' && existing.status !== 'SCHEDULED') {
      throw new ConflictError(
        `Cannot schedule content in status ${existing.status}; must be APPROVED or SCHEDULED`
      );
    }
    if (existing.currentRevisionId) {
      const revision = await prisma.contentRevision.findUnique({
        where: { id: existing.currentRevisionId },
        select: { guardianResult: true },
      });
      if (revision?.guardianResult === 'BLOCK') {
        throw new ValidationServiceError(
          'Cannot schedule content with Guardian BLOCK result'
        );
      }
    }
    return prisma.content.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt },
    });
  }

  /**
   * Direct publish is disabled — only the n8n publish-receipt route may
   * transition Content.status to PUBLISHED.
   */
  async publish(_id: string) {
    throw new Error(
      'Direct publish is disabled. Content becomes PUBLISHED only via /api/integrations/n8n/publish-receipt.'
    );
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
      guardianPassRate: Math.round(guardianStats._avg.guardianScore || 0),
      contentToDevAttribution: attributionStats._sum.signups || 0,
    };
  }
}

export const contentService = new ContentService();
