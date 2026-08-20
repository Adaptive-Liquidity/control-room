import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

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
    _count: {
      select: {
        contents: { where: { projectId } },
        approvals: { where: { content: { projectId } } },
      },
    },
  } as const;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'settings.manage');
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const users = await prisma.user.findMany({
      where: { memberships: { some: { projectId: ctx.projectId } } },
      select: userSelectForProject(ctx.projectId),
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items: users });
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
    requirePermission(session, 'settings.manage');
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const body = inviteSchema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: body.name?.trim() || email.split('@')[0],
          role: body.role,
          isActive: true,
          memberships: {
            create: { projectId: ctx.projectId, role: body.role },
          },
        },
        select: userSelectForProject(ctx.projectId),
      });

      await tx.activityLog.create({
        data: {
          userId: session.user.id,
          projectId: ctx.projectId,
          type: 'SETTINGS_CHANGED',
          description: `Invited user ${created.email} as ${created.role}`,
          metadata: { invitedUserId: created.id, role: created.role },
        },
      });
      return created;
    });

    return NextResponse.json({ user }, { status: 201 });
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
