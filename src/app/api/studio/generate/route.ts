import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ForbiddenError } from "@/lib/rbac";
import { assertStudioMutator } from "@/lib/content/studio-mutate";
import { callN8nGenerate, generateRequestSchema } from "@/lib/n8n/generate-client";
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from "@/lib/project/context";
import { prisma } from "@/lib/prisma";
import {
  composeContextPack,
  type ContextPack,
} from "@/lib/context/compose-packs";
import { evaluateCampaignPolicy } from "@/lib/n8n/campaign-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get("x-project-id"),
    });

    const body = await req.json();
    const validated = generateRequestSchema.parse(body);

    if (validated.contentId) {
      const row = await prisma.content.findUnique({
        where: { id: validated.contentId },
        include: {
          approvals: {
            where: { status: 'NEEDS_REVISION' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { reviewer: { select: { name: true } } },
          },
        },
      });
      if (!row || row.projectId !== ctx.projectId) {
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }
      assertStudioMutator({
        userId: session.user.id,
        role: ctx.role,
        authorId: row.authorId,
      });
      validated.mode = 'rewrite';
      validated.currentTitle = row.title;
      validated.currentBody = row.body;
      validated.reviewComment = row.approvals[0]?.comment ?? null;
      if (row.campaignId) {
        validated.campaignId = row.campaignId;
      } else {
        delete validated.campaignId;
      }
    } else {
      requireProjectPermission(ctx, "content.edit");
      validated.mode = 'create';
      delete validated.currentTitle;
      delete validated.currentBody;
      delete validated.reviewComment;
    }

    let campaign: { id: string; objective: string | null; thesis: string | null } | null =
      null;
    if (validated.campaignId) {
      campaign = await prisma.campaign.findFirst({
        where: { id: validated.campaignId, projectId: ctx.projectId },
        select: { id: true, objective: true, thesis: true },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "campaignId not found in active project" },
          { status: 404 }
        );
      }
      const decision = await evaluateCampaignPolicy(validated.campaignId);
      if (!decision) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      }
      if (!decision.allowed) {
        return NextResponse.json(
          {
            error: `Campaign policy rejected generate: ${decision.reason}`,
            reason: decision.reason,
          },
          { status: 409 }
        );
      }
    }

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      include: {
        activeContextVersion: true,
        company: { include: { activeContextVersion: true } },
      },
    });

    if (!project?.activeContextVersion || !project.company.activeContextVersion) {
      return NextResponse.json(
        { error: 'Published company and project context packs are required' },
        { status: 409 }
      );
    }

    const composed = composeContextPack({
      company: project.company.activeContextVersion.pack as ContextPack,
      project: project.activeContextVersion.pack as ContextPack,
      companyVersionId: project.company.activeContextVersion.id,
      projectVersionId: project.activeContextVersion.id,
      campaign: campaign
        ? { objective: campaign.objective, thesis: campaign.thesis }
        : undefined,
    });
    const contextPack = composed.pack;
    const composedHash = composed.composedHash;

    const result = await callN8nGenerate({
      ...validated,
      projectId: ctx.projectId,
      contextPack,
      composedHash,
    });

    if (!result.ok) {
      const status = result.status === 503 || !process.env.N8N_GENERATE_WEBHOOK_URL ? 503 : 502;
      return NextResponse.json({ error: result.error }, { status: result.status ?? status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error("POST /api/studio/generate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
