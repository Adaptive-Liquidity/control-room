import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ForbiddenError, requirePermission } from '@/lib/rbac';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);
    const publicSignup = process.env.ALLOW_PUBLIC_SIGNUP === 'true';

    let role: UserRole = UserRole.VIEWER;

    if (publicSignup) {
      // Public signup never grants privileged roles.
      role = UserRole.VIEWER;
    } else {
      const session = await getServerSession(authOptions);
      try {
        requirePermission(session, 'settings.manage');
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return NextResponse.json(
            { error: 'Signup is invite-only. An ADMIN must create accounts.' },
            { status: err.statusCode }
          );
        }
        throw err;
      }
      if (!validated.role) {
        return NextResponse.json(
          { error: 'role is required when creating users via invite' },
          { status: 400 }
        );
      }
      if (validated.role === UserRole.SERVICE) {
        return NextResponse.json(
          { error: 'SERVICE role cannot be created via signup' },
          { status: 400 }
        );
      }
      role = validated.role;
    }

    const existing = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validated.email.toLowerCase(),
        password: hashedPassword,
        name: validated.name || validated.email.split('@')[0],
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/auth/signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
