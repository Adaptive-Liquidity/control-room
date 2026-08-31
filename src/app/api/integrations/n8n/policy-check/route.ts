import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  UNSCOPED_POLICY_DECISION,
  evaluateCampaignPolicy,
} from '@/lib/n8n/campaign-policy';
import { n8nPolicyCheckSchema } from '@/lib/n8n/contracts';
import { SignatureError, verifyN8nHmac } from '@/lib/n8n/verify-signature';
import { prisma } from '@/lib/prisma';
import {
  composeContextPack,
  type ContextPack,
} from '@/lib/context/compose-packs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    verifyN8nHmac({
      secret: process.env.N8N_INGRESS_SECRET ?? '',
      timestampHeader: req.headers.get('x-n8n-timestamp'),
      signatureHeader: req.headers.get('x-n8n-signature'),
      rawBody,
    });

    const payload = n8nPolicyCheckSchema.parse(JSON.parse(rawBody));

    // v1 path: campaign-only or empty — keep existing decision shape; packs additive
    if (!payload.campaignId && !payload.projectId) {
      return NextResponse.json(UNSCOPED_POLICY_DECISION, { status: 200 });
    }

    let projectId = payload.projectId;
    let campaign:
      | {
          id: string;
          objective: string | null;
          thesis: string | null;
          projectId: string;
        }
      | null = null;

    if (payload.campaignId) {
      campaign = await prisma.campaign.findUnique({
        where: { id: payload.campaignId },
        select: { id: true, objective: true, thesis: true, projectId: true },
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

      const decision = await evaluateCampaignPolicy(payload.campaignId, undefined, {
        contentRisk: payload.contentRiskTier,
      });
      if (!decision) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      if (!decision.allowed) {
        return NextResponse.json(decision, { status: 200 });
      }

      const composed = await composeForProject(projectId, campaign);
      if (!composed) {
        return NextResponse.json(
          { ...decision, allowed: false, reason: 'no_context_pack' },
          { status: 200 }
        );
      }

      const known = payload.knownComposedHash || payload.knownContextHash;
      const contextUnchanged = Boolean(known && known === composed.composedHash);
      const wantPack =
        !contextUnchanged &&
        (payload.include == null || payload.include.includes('contextPack'));
      return NextResponse.json(
        {
          ...decision,
          project: composed.projectMeta,
          contextUnchanged,
          ...(wantPack ? { contextPack: composed.pack } : {}),
          companyContextHash: composed.companyContextHash,
          projectContextHash: composed.projectContextHash,
          composedHash: composed.composedHash,
        },
        { status: 200 }
      );
    }

    // projectId only
    const decision = { ...UNSCOPED_POLICY_DECISION };
    const composed = await composeForProject(projectId!);
    if (!composed) {
      return NextResponse.json(
        { ...decision, allowed: false, reason: 'no_context_pack' },
        { status: 200 }
      );
    }
    const known = payload.knownComposedHash || payload.knownContextHash;
    const contextUnchanged = Boolean(known && known === composed.composedHash);
    const wantPack =
      !contextUnchanged &&
      (payload.include == null || payload.include.includes('contextPack'));
    return NextResponse.json(
      {
        ...decision,
        project: composed.projectMeta,
        contextUnchanged,
        ...(wantPack ? { contextPack: composed.pack } : {}),
        companyContextHash: composed.companyContextHash,
        projectContextHash: composed.projectContextHash,
        composedHash: composed.composedHash,
      },
      { status: 200 }
    );
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
    console.error('POST /api/integrations/n8n/policy-check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function composeForProject(
  projectId: string,
  campaign?: { objective: string | null; thesis: string | null } | null
) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      activeContextVersion: true,
      company: { include: { activeContextVersion: true } },
    },
  });
  if (!project?.activeContextVersion || !project.company.activeContextVersion) {
    return null;
  }

  const composed = composeContextPack({
    company: project.company.activeContextVersion.pack as ContextPack,
    project: project.activeContextVersion.pack as ContextPack,
    companyVersionId: project.company.activeContextVersion.id,
    projectVersionId: project.activeContextVersion.id,
    campaign: campaign
      ? { objective: campaign.objective, thesis: campaign.thesis }
      : undefined,
    includeReference: false,
  });

  return {
    ...composed,
    projectMeta: {
      id: project.id,
      slug: project.slug,
      contextVersion: project.activeContextVersion.version,
      contextHash: project.activeContextVersion.contentHash,
      companyId: project.companyId,
      companySlug: project.company.slug,
    },
  };
}
