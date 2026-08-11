import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';

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
  _count: { select: { contents: true, approvals: true } },
} as const;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'settings.manage');

    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items: users });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
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
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: body.name?.trim() || email.split('@')[0],
        role: body.role,
        isActive: true,
      },
      select: userSelect,
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        type: 'SETTINGS_CHANGED',
        description: `Invited user ${user.email} as ${user.role}`,
        metadata: { invitedUserId: user.id, role: user.role },
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
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
