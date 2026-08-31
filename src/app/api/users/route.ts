import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';
import { resolveInviteRoles } from '@/lib/project/invite-roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inviteSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole),
});

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

function userSelectForProject(projectId: string) {
  return {
    ...userSelect,
    memberships: {
      where: { projectId },
      select: { role: true },
      take: 1,
    },
    _count: {
      select: {
        contents: { where: { projectId } },
        approvals: { where: { content: { projectId } } },
      },
    },
  } as const;
}

function toProjectUser<
  T extends { role: UserRole; memberships?: Array<{ role: UserRole }> },
>(row: T) {
  const { memberships, ...rest } = row;
  return {
    ...rest,
    globalRole: rest.role,
    role: memberships?.[0]?.role ?? rest.role,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'settings.manage');

    const users = await prisma.user.findMany({
      where: { memberships: { some: { projectId: ctx.projectId } } },
      select: userSelectForProject(ctx.projectId),
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items: users.map(toProjectUser) });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Admin invite: create a user with an explicit role (including SERVICE for n8n). */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'settings.manage');

    const body = inviteSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    const roles = resolveInviteRoles({
      requested: body.role,
      inviterGlobalRole: session.user.role,
      existingGlobalRole: existing?.role ?? null,
    });

    if (existing) {
      const user = await prisma.$transaction(async (tx) => {
        await tx.projectMember.upsert({
          where: {
            projectId_userId: { projectId: ctx.projectId, userId: existing.id },
          },
          create: {
            projectId: ctx.projectId,
            userId: existing.id,
            role: roles.membershipRole,
          },
          update: { role: roles.membershipRole },
        });
        await tx.activityLog.create({
          data: {
            userId: session.user.id,
            projectId: ctx.projectId,
            type: 'SETTINGS_CHANGED',
            description: `Added existing user ${existing.email} to project as ${roles.membershipRole}`,
            metadata: {
              invitedUserId: existing.id,
              role: roles.membershipRole,
              existing: true,
            },
          },
        });
        return tx.user.findUniqueOrThrow({
          where: { id: existing.id },
          select: userSelectForProject(ctx.projectId),
        });
      });
      return NextResponse.json({ user: toProjectUser(user), existing: true });
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: body.name?.trim() || email.split('@')[0],
          role: roles.globalRole ?? body.role,
          isActive: true,
          memberships: {
            create: { projectId: ctx.projectId, role: roles.membershipRole },
          },
        },
        select: userSelectForProject(ctx.projectId),
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          projectId: ctx.projectId,
          type: 'SETTINGS_CHANGED',
          description: `Invited user ${created.email} as ${roles.membershipRole}`,
          metadata: {
            invitedUserId: created.id,
            role: roles.membershipRole,
            globalRole: roles.globalRole,
          },
        },
      });
      return created;
    });

    return NextResponse.json({ user: toProjectUser(user) }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
