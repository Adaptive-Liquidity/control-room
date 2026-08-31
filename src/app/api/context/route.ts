import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';
import { prisma } from '@/lib/prisma';
import { contextPackService } from '@/services/context-pack.service';
import type { ContextPack } from '@/lib/context/compose-packs';
import { mergeCompanyPack, mergeProjectPack } from '@/lib/context/pack-from-fields';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const putSchema = z.object({
  scope: z.enum(['company', 'project']),
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional(),
  oneLiner: z.string().max(300).optional(),
  voiceTone: z.string().max(200).optional(),
  dontSay: z.array(z.string().max(80)).max(40).optional(),
  description: z.string().max(2000).optional(),
});

function versionMeta(row: {
  version: number;
  contentHash: string;
  publishedAt: Date | null;
} | null) {
  if (!row) return null;
  return {
    version: row.version,
    contentHash: row.contentHash,
    publishedAt: row.publishedAt,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      include: {
        activeContextVersion: true,
        company: { include: { activeContextVersion: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
      company: {
        id: project.company.id,
        name: project.company.name,
        slug: project.company.slug,
        legalName: project.company.legalName,
        pack: (project.company.activeContextVersion?.pack as ContextPack | null) ?? null,
        ...versionMeta(project.company.activeContextVersion),
      },
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        pack: (project.activeContextVersion?.pack as ContextPack | null) ?? null,
        ...versionMeta(project.activeContextVersion),
      },
    });
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/context error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = putSchema.parse(await req.json());

    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(
      ctx,
      body.scope === 'company' ? 'company.manage' : 'project.manage'
    );

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      include: {
        activeContextVersion: true,
        company: { include: { activeContextVersion: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (body.scope === 'company') {
      const pack = mergeCompanyPack(
        (project.company.activeContextVersion?.pack as ContextPack | null) ?? null,
        {
          name: body.name ?? project.company.name,
          legalName: body.legalName ?? project.company.legalName ?? undefined,
          oneLiner: body.oneLiner,
          voiceTone: body.voiceTone,
          dontSay: body.dontSay,
        }
      );
      const row = await contextPackService.publishCompanyPack({
        companyId: project.companyId,
        pack,
        createdById: session.user.id,
        summary: 'Settings brand voice',
      });
      return NextResponse.json({
        scope: 'company',
        version: row.version,
        contentHash: row.contentHash,
        publishedAt: row.publishedAt,
      });
    }

    const pack = mergeProjectPack(
      (project.activeContextVersion?.pack as ContextPack | null) ?? null,
      {
        name: body.name ?? project.name,
        oneLiner: body.oneLiner,
        description: body.description,
      }
    );
    const row = await contextPackService.publishProjectPack({
      projectId: project.id,
      pack,
      createdById: session.user.id,
      summary: 'Settings project context',
    });
    return NextResponse.json({
      scope: 'project',
      version: row.version,
      contentHash: row.contentHash,
      publishedAt: row.publishedAt,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes('Company must have a published')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('PUT /api/context error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
