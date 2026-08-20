import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { evaluateCampaignPolicy, CampaignPolicyRejectedError } from '@/lib/n8n/campaign-policy';
import { n8nDraftIngressSchema } from '@/lib/n8n/contracts';
import { riskTierFromGuardian } from '@/lib/guardian/risk-tier';
import {
  SignatureError,
  assertEventIdUnused,
  verifyN8nHmac,
} from '@/lib/n8n/verify-signature';
import { contentService } from '@/services/content.service';
import { emitContentCreated } from '@/lib/pusher/server';

export const runtime = 'nodejs';

async function resolveServiceAuthorIdForProject(projectId: string): Promise<string | null> {
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      role: 'SERVICE',
      user: { isActive: true },
    },
    select: { userId: true },
  });
  if (member) return member.userId;

  // Fallback: any active SERVICE user (single-tenant transition)
  const serviceUser = await prisma.user.findFirst({
    where: { role: 'SERVICE', isActive: true },
    select: { id: true },
  });
  return serviceUser?.id ?? null;
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

    const payload = n8nDraftIngressSchema.parse(JSON.parse(rawBody));

    const existing = await prisma.content.findUnique({
      where: { externalDraftId: payload.externalDraftId },
      include: {
        author: { select: { id: true, email: true, name: true, role: true } },
        revisions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          contentId: existing.id,
          revisionId: existing.currentRevisionId,
          status: existing.status,
          guardianScore: existing.guardianScore,
          idempotent: true,
        },
        { status: 200 }
      );
    }

    if (payload.campaignId) {
      const decision = await evaluateCampaignPolicy(payload.campaignId);
      if (!decision) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (!decision.allowed) {
        return NextResponse.json(
          {
            error: `Campaign policy rejected this draft: ${decision.reason}`,
            reason: decision.reason,
          },
          { status: 409 }
        );
      }
    }

    await assertEventIdUnused(payload.eventId);

    let projectId = payload.projectId ?? null;
    if (payload.campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: payload.campaignId },
        select: { projectId: true },
      });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (projectId && projectId !== campaign.projectId) {
        return NextResponse.json(
          { error: 'campaignId does not belong to projectId' },
          { status: 409 }
        );
      }
      projectId = campaign.projectId;
    }
    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId required when campaignId is not provided' },
        { status: 400 }
      );
    }

    const authorId = await resolveServiceAuthorIdForProject(projectId);
    if (!authorId) {
      return NextResponse.json(
        {
          error:
            'No active SERVICE member for this project. Invite a SERVICE user to the project before ingesting n8n drafts.',
        },
        { status: 503 }
      );
    }

    const resumeUrlEncrypted = encrypt(payload.resumeUrl);

    const content = await prisma.$transaction(async (tx) => {
      if (payload.campaignId) {
        const decision = await evaluateCampaignPolicy(payload.campaignId, tx);
        if (!decision) {
          throw new Error('Campaign not found');
        }
        if (!decision.allowed) {
          throw new CampaignPolicyRejectedError(decision.reason ?? 'daily_content_limit');
        }
      }

      const created = await tx.content.create({
        data: {
          title: payload.content.title,
          body: payload.content.body,
          type: payload.content.type,
          channel: payload.content.channel,
          authorId,
          projectId: projectId!,
          campaignId: payload.campaignId,
          origin: 'N8N',
          externalDraftId: payload.externalDraftId,
          n8nWorkflowId: payload.workflowId,
          n8nExecutionId: payload.executionId,
          status: 'PENDING_REVIEW',
        },
      });

      const { revision, guardianResult } = await contentService.createRevision(
        created.id,
        {
          title: payload.content.title,
          body: payload.content.body,
          type: payload.content.type,
          channel: payload.content.channel,
        },
        authorId,
        projectId!,
        tx
      );

      await tx.n8nBridgeJob.create({
        data: {
          eventId: payload.eventId,
          externalDraftId: payload.externalDraftId,
          contentId: created.id,
          workflowId: payload.workflowId,
          executionId: payload.executionId,
          resumeUrlEncrypted,
          resumeExpiresAt: payload.resumeExpiresAt
            ? new Date(payload.resumeExpiresAt)
            : null,
          resumeStatus: 'PENDING',
        },
      });

      await tx.activityLog.create({
        data: {
          userId: authorId,
          projectId: projectId!,
          type: 'CONTENT_CREATED',
          description: `n8n ingested draft: "${payload.content.title}"`,
          metadata: {
            contentId: created.id,
            revisionId: revision.id,
            externalDraftId: payload.externalDraftId,
            eventId: payload.eventId,
            guardianScore: guardianResult.score,
            guardianResult: guardianResult.result,
          },
        },
      });

      return {
        contentId: created.id,
        revisionId: revision.id,
        status: 'PENDING_REVIEW' as const,
        guardianScore: guardianResult.score,
        guardianResult: guardianResult.result,
        projectId: projectId!,
        riskTier: riskTierFromGuardian(guardianResult.result, guardianResult.score),
        requireHuman: payload.campaignId
          ? (
              await evaluateCampaignPolicy(payload.campaignId, tx, {
                contentRisk: riskTierFromGuardian(
                  guardianResult.result,
                  guardianResult.score
                ),
              })
            )?.requireHuman ?? true
          : true,
      };
    });

    await emitContentCreated({
      contentId: content.contentId,
      revisionId: content.revisionId,
      status: content.status,
      projectId: content.projectId,
    });

    return NextResponse.json({ ...content, idempotent: false }, { status: 201 });
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
    if (error instanceof CampaignPolicyRejectedError) {
      return NextResponse.json(
        {
          error: `Campaign policy rejected this draft: ${error.reason}`,
          reason: error.reason,
        },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === 'Campaign not found') {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    console.error('POST /api/integrations/n8n/drafts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
