import type { Session } from 'next-auth';
import type { Channel, ContentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, hasPermission } from '@/lib/rbac';
import {
  ConflictError,
  ValidationServiceError,
  contentService,
} from '@/services/content.service';
import {
  OUTBOX_TYPE_N8N_RESUME,
  outboxService,
} from '@/lib/outbox/outbox.service';
import type { N8nResumePayload } from '@/lib/n8n/contracts';
import {
  emitContentApproved,
  emitContentRejected,
  emitContentUpdated,
} from '@/lib/pusher/server';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED';

export class ApprovalService {
  async decide(opts: {
    session: Session;
    projectId: string;
    contentId: string;
    expectedRevisionId: string;
    decision: ApprovalDecision;
    comment?: string;
    edits?: {
      title?: string;
      body?: string;
      channel?: Channel;
      type?: ContentType;
    };
  }) {
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: opts.projectId,
          userId: opts.session.user.id,
        },
      },
      select: { role: true },
    });
    if (!membership || !hasPermission(membership.role, 'content.approve')) {
      throw new ForbiddenError('Missing permission: content.approve');
    }
    const reviewerId = opts.session.user.id;

    if (opts.decision === 'REJECTED' && !opts.comment?.trim()) {
      throw new ValidationServiceError('Comment required for rejection');
    }
    if (opts.decision === 'REVISION_REQUESTED' && !opts.comment?.trim()) {
      throw new ValidationServiceError('Comment required when requesting revision');
    }

    const { content, outboxEventId, revisionId } = await prisma.$transaction(async (tx) => {
      const existing = await tx.content.findUnique({
        where: { id: opts.contentId },
        include: {
          bridgeJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });

      if (!existing) {
        throw new ValidationServiceError('Content not found');
      }
      if (existing.projectId !== opts.projectId) {
        throw new ValidationServiceError('Content not found');
      }

      if (existing.currentRevisionId !== opts.expectedRevisionId) {
        throw new ConflictError(
          'Stale revision: content was updated since the reviewer loaded it'
        );
      }

      let revisionId = opts.expectedRevisionId;
      let revision = await tx.contentRevision.findUniqueOrThrow({
        where: { id: revisionId },
      });

      if (opts.edits && (opts.edits.title || opts.edits.body || opts.edits.channel || opts.edits.type)) {
        const { revision: newRevision, guardianResult } = await contentService.createRevision(
          opts.contentId,
          {
            title: opts.edits.title ?? revision.title,
            body: opts.edits.body ?? revision.body,
            channel: opts.edits.channel ?? revision.channel,
            type: opts.edits.type ?? revision.type,
          },
          reviewerId,
          opts.projectId,
          tx
        );
        if (guardianResult.result === 'BLOCK') {
          throw new ValidationServiceError(
            'Edited revision failed Guardian with BLOCK; approval aborted'
          );
        }
        revision = newRevision;
        revisionId = newRevision.id;
      }

      const approvalStatus =
        opts.decision === 'APPROVED'
          ? 'APPROVED'
          : opts.decision === 'REJECTED'
            ? 'REJECTED'
            : 'NEEDS_REVISION';

      const contentStatus =
        opts.decision === 'APPROVED'
          ? 'APPROVED'
          : opts.decision === 'REJECTED'
            ? 'REJECTED'
            : 'REVISION_REQUESTED';

      await tx.approval.create({
        data: {
          contentId: opts.contentId,
          revisionId,
          reviewerId,
          status: approvalStatus,
          comment: opts.comment,
        },
      });

      const updated = await tx.content.update({
        where: { id: opts.contentId },
        data: { status: contentStatus },
        include: {
          author: true,
          approvals: { include: { reviewer: true }, orderBy: { createdAt: 'desc' }, take: 5 },
        },
      });

      await tx.activityLog.create({
        data: {
          userId: reviewerId,
          projectId: opts.projectId,
          type: opts.decision === 'APPROVED' ? 'CONTENT_APPROVED' : 'CONTENT_REJECTED',
          description: `${opts.decision}: "${updated.title}"${
            opts.comment ? ` — ${opts.comment}` : ''
          }`,
          metadata: {
            contentId: opts.contentId,
            revisionId,
            decision: opts.decision,
          },
        },
      });

      let createdOutboxId: string | null = null;
      const bridgeJob = existing.bridgeJobs[0];
      if (existing.origin === 'N8N' && bridgeJob) {
        const resume: N8nResumePayload = {
          schemaVersion: '1',
          decision: opts.decision,
          contentId: opts.contentId,
          revisionId,
          contentHash: revision.contentHash,
          title: revision.title,
          body: revision.body,
          channel: revision.channel,
          guardian: {
            policyVersion: revision.guardianPolicyVersion,
            score: revision.guardianScore,
          },
          review: {
            reviewerId,
            decidedAt: new Date().toISOString(),
            comment: opts.comment ?? null,
          },
        };

        const event = await outboxService.enqueue(
          {
            type: OUTBOX_TYPE_N8N_RESUME,
            aggregateId: opts.contentId,
            payload: {
              bridgeJobId: bridgeJob.id,
              resume,
            } as unknown as Prisma.InputJsonValue,
          },
          tx
        );
        createdOutboxId = event.id;
      }

      return { content: updated, outboxEventId: createdOutboxId, revisionId };
    });

    if (outboxEventId) {
      // Best-effort immediate delivery; leave PENDING/RETRY for cron on failure.
      try {
        await outboxService.processOne(outboxEventId);
      } catch (err) {
        console.error('Immediate outbox delivery failed:', err);
      }
    }

    const realtimePayload = {
      contentId: content.id,
      projectId: opts.projectId,
      revisionId,
      status: content.status,
    };
    if (opts.decision === 'APPROVED') {
      await emitContentApproved(realtimePayload);
    } else if (opts.decision === 'REJECTED') {
      await emitContentRejected(realtimePayload);
    } else {
      await emitContentUpdated(realtimePayload);
    }

    return content;
  }
}

export const approvalService = new ApprovalService();
