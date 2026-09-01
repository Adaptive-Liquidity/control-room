// src/services/content.service.ts
import { createHash } from 'crypto';
import type { ApprovalStatus, Channel, ContentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { guardianService } from '@/lib/guardian/guardian.service';
import { riskTierFromGuardian } from '@/lib/guardian/risk-tier';
import { scopedPrisma } from '@/lib/scope/scoped-prisma';
import {
  emitContentCreated,
  emitContentUpdated,
} from '@/lib/pusher/server';
import {
  STUDIO_EDITABLE_STATUSES,
  assertStudioMutator,
  isStudioEditableStatus,
} from '@/lib/content/studio-mutate';
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

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export function hashContent(title: string, body: string): string {
  return createHash('sha256').update(`${title}\n${body}`).digest('hex');
}

async function lockEditableContent(
  tx: Prisma.TransactionClient,
  id: string,
  projectId: string
) {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM contents WHERE id = ${id} AND "projectId" = ${projectId} FOR UPDATE
  `;
  const locked = rows[0];
  if (!locked) throw new NotFoundError('Content not found');
  if (!isStudioEditableStatus(locked.status)) {
    throw new ConflictError(
      `Cannot edit content in status ${locked.status}; must be DRAFT, REVISION_REQUESTED, or REJECTED`
    );
  }
  return locked;
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
    projectId: string,
    tx: Prisma.TransactionClient = prisma
  ) {
    const last = await tx.contentRevision.findFirst({
      where: { contentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    const contentHash = hashContent(data.title, data.body);
    const guardianResult = await guardianService.checkContent(data.body, data.title, {
      projectId,
    });

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
        riskTier: riskTierFromGuardian(guardianResult.result, guardianResult.score),
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
    projectId: string;
    campaignId?: string;
    origin?: 'MANUAL' | 'N8N';
    externalDraftId?: string;
    n8nWorkflowId?: string;
    n8nExecutionId?: string;
    status?: Content['status'];
  }) {
    if (data.campaignId) {
      const campaign = await scopedPrisma(data.projectId, prisma).campaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new ValidationServiceError('Campaign not found in active project');
      }
    }

    const content = await prisma.$transaction(async (tx) => {
      const created = await tx.content.create({
        data: {
          title: data.title,
          body: data.body,
          type: data.type,
          channel: data.channel,
          authorId: data.authorId,
          projectId: data.projectId,
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
        data.projectId,
        tx
      );

      const status = data.status ?? 'PENDING_REVIEW';
      if (guardianResult.result === 'BLOCK' && status === 'PENDING_REVIEW') {
        throw new ValidationServiceError('Guardian BLOCK; revision not saved');
      }

      await tx.activityLog.create({
        data: {
          userId: data.authorId,
          projectId: data.projectId,
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
      projectId: content.projectId,
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
    userId: string,
    projectId: string,
    mutator?: { role: string }
  ) {
    const db = scopedPrisma(projectId, prisma);
    const content = await db.content.findUnique({ where: { id } });
    if (!content) throw new NotFoundError('Content not found');

    const contentFieldsSupplied =
      data.title !== undefined ||
      data.body !== undefined ||
      data.type !== undefined ||
      data.channel !== undefined;
    const attemptingContentWrite = contentFieldsSupplied || data.campaignId !== undefined;

    if (mutator) {
      assertStudioMutator({ userId, role: mutator.role, authorId: content.authorId });
    }
    if (attemptingContentWrite && !isStudioEditableStatus(content.status)) {
      throw new ConflictError(
        `Cannot edit content in status ${content.status}; must be DRAFT, REVISION_REQUESTED, or REJECTED`
      );
    }

    if (data.title !== undefined && !data.title.trim()) {
      throw new BadRequestError('Title and body are required');
    }
    if (data.body !== undefined && !data.body.trim()) {
      throw new BadRequestError('Title and body are required');
    }

    const nextTitle = data.title !== undefined ? data.title.trim() : content.title;
    const nextBody = data.body !== undefined ? data.body.trim() : content.body;
    const nextType = data.type ?? content.type;
    const nextChannel = data.channel ?? content.channel;
    const revisionNeeded =
      (data.title !== undefined && nextTitle !== content.title) ||
      (data.body !== undefined && nextBody !== content.body) ||
      (data.type !== undefined && data.type !== content.type) ||
      (data.channel !== undefined && data.channel !== content.channel);

    if (data.campaignId) {
      const campaign = await db.campaign.findUnique({
        where: { id: data.campaignId },
        select: { id: true },
      });
      if (!campaign) {
        throw new ValidationServiceError('Campaign not found in active project');
      }
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

    const include = {
      author: true,
      approvals: { include: { reviewer: true } },
      campaign: true,
    };

    let updated;
    if (attemptingContentWrite) {
      updated = await prisma.$transaction(async (tx) => {
        const scopedTx = scopedPrisma(projectId, tx);
        await lockEditableContent(tx, id, projectId);
        if (revisionNeeded) {
          const { guardianResult } = await this.createRevision(
            id,
            {
              title: nextTitle,
              body: nextBody,
              type: nextType,
              channel: nextChannel,
            },
            userId,
            projectId,
            tx
          );
          if (guardianResult.result === 'BLOCK') {
            throw new ValidationServiceError('Guardian BLOCK; revision not saved');
          }
        }

        const row = await scopedTx.content.update({
          where: { id },
          data: updateData,
          include,
        });

        await scopedTx.activityLog.create({
          data: {
            userId,
            projectId,
            type: 'CONTENT_UPDATED',
            description: `Updated content: "${row.title}"`,
            metadata: { contentId: id },
          },
        });

        return row;
      });
    } else {
      updated = await db.content.update({
        where: { id },
        data: updateData,
        include,
      });

      await db.activityLog.create({
        data: {
          userId,
          projectId,
          type: 'CONTENT_UPDATED',
          description: `Updated content: "${updated.title}"`,
          metadata: { contentId: id },
        },
      });
    }

    await emitContentUpdated({
      contentId: updated.id,
      projectId,
      revisionId: updated.currentRevisionId ?? undefined,
      status: updated.status,
    });

    return updated;
  }

  async submit(id: string, userId: string, projectId: string, role: string) {
    const db = scopedPrisma(projectId, prisma);
    const content = await db.content.findUnique({ where: { id } });
    if (!content) throw new ValidationServiceError('Content not found');
    assertStudioMutator({ userId, role, authorId: content.authorId });
    if (!isStudioEditableStatus(content.status)) {
      throw new ConflictError(
        `Cannot submit content in status ${content.status}`
      );
    }
    if (!content.title.trim() || !content.body.trim()) {
      throw new BadRequestError('Title and body are required');
    }
    if (content.currentRevisionId) {
      const revision = await prisma.contentRevision.findUnique({
        where: { id: content.currentRevisionId },
        select: { guardianResult: true },
      });
      if (revision?.guardianResult === 'BLOCK') {
        throw new ValidationServiceError('Cannot submit content with Guardian BLOCK result');
      }
    }
    const previousStatus = content.status;
    const updated = await prisma.$transaction(async (tx) => {
      const scopedTx = scopedPrisma(projectId, tx);
      const moved = await scopedTx.content.updateMany({
        where: { id, status: { in: [...STUDIO_EDITABLE_STATUSES] } },
        data: { status: 'PENDING_REVIEW' },
      });
      if (moved.count === 0) {
        throw new ConflictError(`Cannot submit content in status ${content.status}`);
      }
      const row = await scopedTx.content.findUnique({
        where: { id },
        include: {
          author: true,
          approvals: { include: { reviewer: true } },
          campaign: true,
        },
      });
      if (!row) throw new NotFoundError('Content not found');
      await scopedTx.activityLog.create({
        data: {
          userId,
          projectId,
          type: 'CONTENT_UPDATED',
          description: `Submitted for review: "${row.title}"`,
          metadata: { contentId: id, from: previousStatus, to: 'PENDING_REVIEW' },
        },
      });
      return row;
    });
    await emitContentUpdated({
      contentId: updated.id,
      projectId,
      revisionId: updated.currentRevisionId ?? undefined,
      status: updated.status,
    });
    return updated;
  }

  async getById(id: string, projectId: string) {
    return scopedPrisma(projectId, prisma).content.findUnique({
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
  async getDetail(id: string, projectId: string) {
    const content = await scopedPrisma(projectId, prisma).content.findUnique({
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

    const assets = currentRevision
      ? await prisma.contentAsset.findMany({
          where: { contentRevisionId: currentRevision.id },
          orderBy: { position: 'asc' },
          include: {
            asset: { select: { id: true, originalFilename: true, mimeType: true } },
          },
        })
      : [];

    const latestRevision =
      content.approvals.find(
        (a: { status: ApprovalStatus; comment: string | null; createdAt: Date; reviewer: { name: string | null } }) =>
          a.status === 'NEEDS_REVISION'
      ) ?? null;
    const revisionRequest = latestRevision
      ? {
          comment: latestRevision.comment,
          reviewerName: latestRevision.reviewer.name,
          createdAt: latestRevision.createdAt,
        }
      : null;

    const { approvals, ...contentFields } = content;

    return {
      content: contentFields,
      currentRevision,
      priorRevision,
      approvals,
      assets,
      revisionRequest,
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
      projectId: string;
      page?: number;
      limit?: number;
    }
  ) {
    const { status, channel, authorId, campaignId, projectId, page = 1, limit = 20 } = options;

    const where: Prisma.ContentWhereInput = {};
    if (status) where.status = status as Content['status'];
    if (channel) where.channel = channel as Channel;
    if (authorId) where.authorId = authorId;
    if (campaignId) where.campaignId = campaignId;
    where.projectId = projectId;

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

  async schedule(id: string, scheduledAt: Date, projectId: string) {
    const db = scopedPrisma(projectId, prisma);
    const existing = await db.content.findUnique({ where: { id } });
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
    return db.content.update({
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

  async getDashboardStats(projectId: string) {
    const db = scopedPrisma(projectId, prisma);
    const [
      pendingCount,
      scheduledCount,
      publishedThisWeek,
      activeAgents,
      guardianStats,
      attributionStats,
    ] = await Promise.all([
      db.content.count({ where: { status: 'PENDING_REVIEW' } }),
      db.content.count({ where: { status: 'SCHEDULED' } }),
      db.content.count({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.agent.count({ where: { status: 'ONLINE' } }),
      db.content.aggregate({
        where: { status: { in: ['APPROVED', 'PUBLISHED'] } },
        _avg: { guardianScore: true },
      }),
      db.content.aggregate({
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
