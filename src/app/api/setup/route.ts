import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, hasPermission, requirePermission } from '@/lib/rbac';
import { contextPackService } from '@/services/context-pack.service';
import type { ContextPack } from '@/lib/context/compose-packs';
import { isUniqueConstraintError } from '@/lib/prisma-errors';
import { evaluateSetupGate } from '@/lib/setup/setup-gate';

const setupSchema = z.object({
  company: z.object({
    name: z.string().min(1).max(200),
    legalName: z.string().max(200).optional(),
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    oneLiner: z.string().max(300).optional(),
    voiceTone: z.string().max(200).optional(),
    dontSay: z.array(z.string().max(80)).max(40).optional(),
  }),
  project: z.object({
    name: z.string().min(1).max(200),
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    oneLiner: z.string().max(300).optional(),
    description: z.string().max(2000).optional(),
  }),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      select: { id: true, name: true, slug: true, setupCompletedAt: true },
    });
    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      include: {
        project: {
          select: {
            id: true,
            activeContextVersionId: true,
            company: { select: { id: true, activeContextVersionId: true } },
          },
        },
      },
    });
    const gate = evaluateSetupGate({
      memberships: memberships.map((row) => ({
        projectId: row.projectId,
        companyId: row.project.company.id,
        hasPublishedCompanyPack: Boolean(row.project.company.activeContextVersionId),
        hasPublishedProjectPack: Boolean(row.project.activeContextVersionId),
      })),
    });

    return NextResponse.json({
      hasCompany: Boolean(company),
      company: company ? { id: company.id, name: company.name, slug: company.slug } : null,
      canManage: hasPermission(session.user.role, 'company.manage'),
      ready: gate.ready,
      missing: gate.ready ? [] : gate.missing,
    });
  } catch (error) {
    console.error('GET /api/setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'company.manage');

    const body = setupSchema.parse(await req.json());

    const existingCompany = await prisma.company.findFirst();
    if (existingCompany) {
      // Second project under existing company
      const project = await prisma.$transaction(async (tx) => {
        const p = await tx.project.create({
          data: {
            companyId: existingCompany.id,
            slug: body.project.slug,
            name: body.project.name,
            createdById: session!.user.id,
          },
        });
        await tx.projectMember.create({
          data: {
            projectId: p.id,
            userId: session!.user.id,
            role: 'ADMIN',
          },
        });
        return p;
      });

      const pack: ContextPack = {
        schemaVersion: '1',
        promptCore: {
          identity: {
            name: body.project.name,
            oneLiner: body.project.oneLiner,
            description: body.project.description,
          },
          voice: {},
          prohibitions: { forbiddenClaims: [], requiredDisclaimers: [] },
          keyFacts: [],
        },
      };
      await contextPackService.publishProjectPack({
        projectId: project.id,
        pack,
        createdById: session!.user.id,
        summary: 'Setup wizard v1',
      });
      await prisma.user.update({
        where: { id: session!.user.id },
        data: { lastActiveProjectId: project.id },
      });
      return NextResponse.json({ projectId: project.id, companyId: existingCompany.id });
    }

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          slug: body.company.slug,
          name: body.company.name,
          legalName: body.company.legalName,
          createdById: session!.user.id,
        },
      });
      const project = await tx.project.create({
        data: {
          companyId: company.id,
          slug: body.project.slug,
          name: body.project.name,
          createdById: session!.user.id,
        },
      });
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: session!.user.id,
          role: 'ADMIN',
        },
      });
      return { company, project };
    });

    const companyPack: ContextPack = {
      schemaVersion: '1',
      promptCore: {
        identity: {
          name: body.company.name,
          legalName: body.company.legalName,
          oneLiner: body.company.oneLiner,
        },
        voice: {
          tone: body.company.voiceTone ?? 'precise, humble, architectural',
          dont: body.company.dontSay ?? [],
        },
        prohibitions: {
          forbiddenClaims: body.company.dontSay ?? [],
          requiredDisclaimers: [],
        },
        keyFacts: [],
      },
    };
    await contextPackService.publishCompanyPack({
      companyId: result.company.id,
      pack: companyPack,
      createdById: session!.user.id,
      summary: 'Setup wizard v1',
    });

    const projectPack: ContextPack = {
      schemaVersion: '1',
      promptCore: {
        identity: {
          name: body.project.name,
          oneLiner: body.project.oneLiner,
          description: body.project.description,
        },
        voice: {},
        prohibitions: { forbiddenClaims: [], requiredDisclaimers: [] },
        keyFacts: [],
      },
    };
    await contextPackService.publishProjectPack({
      projectId: result.project.id,
      pack: projectPack,
      createdById: session!.user.id,
      summary: 'Setup wizard v1',
    });

    await prisma.user.update({
      where: { id: session!.user.id },
      data: { lastActiveProjectId: result.project.id },
    });

    return NextResponse.json({
      companyId: result.company.id,
      projectId: result.project.id,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'Company or project slug already exists' },
        { status: 409 }
      );
    }
    console.error('POST /api/setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
