import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { n8nPublishReceiptSchema } from '@/lib/n8n/contracts';
import { SignatureError, verifyN8nHmac } from '@/lib/n8n/verify-signature';
import {
  emitContentPublished,
  emitContentUpdated,
} from '@/lib/pusher/server';

export const runtime = 'nodejs';

class PublishTransitionError extends Error {
  status = 422;
  constructor(message: string) {
    super(message);
    this.name = 'PublishTransitionError';
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    verifyN8nHmac({
      secret: process.env.N8N_INGRESS_SECRET ?? '',
      timestampHeader: req.headers.get('x-n8n-timestamp'),
      signatureHeader: req.headers.get('x-n8n-signature'),
      rawBody,
    });

    const payload = n8nPublishReceiptSchema.parse(JSON.parse(rawBody));

    const existing = await prisma.publishReceipt.findUnique({
      where: { eventId: payload.eventId },
    });
    if (existing) {
      return NextResponse.json({ receipt: existing, idempotent: true }, { status: 200 });
    }

    const revision = await prisma.contentRevision.findUnique({
      where: { id: payload.revisionId },
      include: { content: true },
    });

    if (!revision || revision.contentId !== payload.contentId) {
      return NextResponse.json(
        { error: 'contentId/revisionId mismatch or not found' },
        { status: 404 }
      );
    }

    if (revision.contentHash !== payload.contentHash) {
      return NextResponse.json(
        { error: 'contentHash does not match revision' },
        { status: 422 }
      );
    }

    if (revision.guardianResult === 'BLOCK') {
      return NextResponse.json(
        { error: 'Cannot publish content blocked by Guardian' },
        { status: 422 }
      );
    }

    if (payload.status === 'SUCCESS') {
      const publishable = revision.content.status === 'APPROVED' || revision.content.status === 'SCHEDULED';
      if (!publishable) {
        return NextResponse.json(
          {
            error: `Content must be APPROVED or SCHEDULED before publish receipt (got ${revision.content.status})`,
          },
          { status: 422 }
        );
      }
      if (revision.content.currentRevisionId !== payload.revisionId) {
        return NextResponse.json(
          { error: 'Publish receipt revision is not the current revision' },
          { status: 422 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.publishReceipt.create({
        data: {
          eventId: payload.eventId,
          contentId: payload.contentId,
          revisionId: payload.revisionId,
          contentHash: payload.contentHash,
          channel: payload.channel,
          platformPostId: payload.platformPostId,
          platformUrl: payload.platformUrl,
          status: payload.status,
          publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
          errorCode: payload.errorCode,
          errorMessage: payload.errorMessage,
          n8nExecutionId: payload.executionId,
          rawMetadata: (payload.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      });

      if (payload.status === 'SUCCESS') {
        const published = await tx.content.updateMany({
          where: {
            id: payload.contentId,
            currentRevisionId: payload.revisionId,
            status: { in: ['APPROVED', 'SCHEDULED'] },
          },
          data: {
            status: 'PUBLISHED',
            publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
          },
        });
        if (published.count !== 1) {
          throw new PublishTransitionError(
            'Publish receipt revision is not the current revision'
          );
        }

        await tx.activityLog.create({
          data: {
            projectId: revision.content.projectId,
            type: 'CONTENT_PUBLISHED',
            description: `Published via n8n receipt: "${revision.title}" on ${payload.channel}`,
            metadata: {
              contentId: payload.contentId,
              revisionId: payload.revisionId,
              eventId: payload.eventId,
              platformPostId: payload.platformPostId,
            },
          },
        });
      }
      // FAILED receipts are recorded without leaving APPROVED/SCHEDULED.

      return receipt;
    });

    if (payload.status === 'SUCCESS') {
      await emitContentPublished({
        contentId: payload.contentId,
        projectId: revision.content.projectId,
        revisionId: payload.revisionId,
        status: 'PUBLISHED',
      });
    } else {
      await emitContentUpdated({
        contentId: payload.contentId,
        projectId: revision.content.projectId,
        revisionId: payload.revisionId,
        status: revision.content.status,
      });
    }

    return NextResponse.json({ receipt: result, idempotent: false }, { status: 201 });
  } catch (error) {
    if (error instanceof SignatureError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (error instanceof PublishTransitionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('POST /api/integrations/n8n/publish-receipt error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
