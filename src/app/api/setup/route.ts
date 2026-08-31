import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, hasPermission, requirePermission } from '@/lib/rbac';
import {
  CompanyPackRequiredError,
  contextPackService,
} from '@/services/context-pack.service';
import type { ContextPack } from '@/lib/context/compose-packs';
import { isUniqueConstraintError } from '@/lib/prisma-errors';
import { evaluateSetupGate } from '@/lib/setup/setup-gate';
import { ACTIVE_PROJECT_COOKIE } from '@/lib/project/context';
import { resolveProjectScope } from '@/lib/scope/project-scope';

type SetupMembershipRow = {
  projectId: string;
  project: {
    id: string;
    activeContextVersionId: string | null;
    company: {
      id: string;
      name: string;
      slug: string;
      activeContextVersionId: string | null;
    };
  };
};

function preferredProjectId(opts: {
  requested?: string | null;
  cookie?: string | null;
  lastActive?: string | null;
}) {
  return opts.requested?.trim() || opts.cookie?.trim() || opts.lastActive?.trim() || undefined;
}

function companyForActiveProject(
  userId: string,
  memberships: SetupMembershipRow[],
  preferred?: string
) {
  if (!memberships.length) return null;
  const scope = resolveProjectScope({
    userId,
    requestedProjectId: preferred,
    memberships: memberships.map((row) => ({
      projectId: row.projectId,
      companyId: row.project.company.id,
      role: 'MEMBER',
    })),
  });
  if (scope.ok) {
    return (
      memberships.find((row) => row.projectId === scope.projectId)?.project.company ?? null
    );
  }
  const unique = new Map(
    memberships.map((row) => [row.project.company.id, row.project.company])
  );
  if (unique.size === 1) {
    return unique.values().next().value ?? null;
  }
  return null;
}

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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      include: {
        project: {
          select: {
            id: true,
            activeContextVersionId: true,
            company: {
              select: { id: true, name: true, slug: true, activeContextVersionId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const scopedCompany = companyForActiveProject(
      session.user.id,
      memberships,
      preferredProjectId({
        cookie: req.cookies.get(ACTIVE_PROJECT_COOKIE)?.value,
        lastActive: session.user.lastActiveProjectId,
      })
    );
    const gate = evaluateSetupGate({
      memberships: memberships.map((row) => ({
        projectId: row.projectId,
        companyId: row.project.company.id,
        hasPublishedCompanyPack: Boolean(row.project.company.activeContextVersionId),
        hasPublishedProjectPack: Boolean(row.project.activeContextVersionId),
      })),
    });

    return NextResponse.json({
      hasCompany: memberships.length > 0,
      company: scopedCompany
        ? { id: scopedCompany.id, name: scopedCompany.name, slug: scopedCompany.slug }
        : null,
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

    const memberships = await prisma.projectMember.findMany({
      where: { userId: session.user.id },
      include: {
        project: {
          select: {
            id: true,
            activeContextVersionId: true,
            company: {
              select: { id: true, name: true, slug: true, activeContextVersionId: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const scopedCompany = companyForActiveProject(
      session.user.id,
      memberships,
      preferredProjectId({
        requested: req.headers.get('x-project-id'),
        cookie: req.cookies.get(ACTIVE_PROJECT_COOKIE)?.value,
        lastActive: session.user.lastActiveProjectId,
      })
    );
    if (memberships.length > 0 && !scopedCompany) {
      return NextResponse.json(
        { error: 'Select an active project before adding another project' },
        { status: 409 }
      );
    }
    const existingCompany = scopedCompany
      ? await prisma.company.findUnique({ where: { id: scopedCompany.id } })
      : null;

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

    if (existingCompany) {
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
        await contextPackService.publishProjectPack(
          {
            projectId: p.id,
            pack: projectPack,
            createdById: session!.user.id,
            summary: 'Setup wizard v1',
          },
          tx
        );
        await tx.user.update({
          where: { id: session!.user.id },
          data: { lastActiveProjectId: p.id },
        });
        return p;
      });
      return NextResponse.json({ projectId: project.id, companyId: existingCompany.id });
    }

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

    const created = await prisma.$transaction(async (tx) => {
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
      await contextPackService.publishCompanyPack(
        {
          companyId: company.id,
          pack: companyPack,
          createdById: session!.user.id,
          summary: 'Setup wizard v1',
        },
        tx
      );
      await contextPackService.publishProjectPack(
        {
          projectId: project.id,
          pack: projectPack,
          createdById: session!.user.id,
          summary: 'Setup wizard v1',
        },
        tx
      );
      await tx.user.update({
        where: { id: session!.user.id },
        data: { lastActiveProjectId: project.id },
      });
      return { company, project };
    });

    return NextResponse.json({
      companyId: created.company.id,
      projectId: created.project.id,
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
    if (error instanceof CompanyPackRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('POST /api/setup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
