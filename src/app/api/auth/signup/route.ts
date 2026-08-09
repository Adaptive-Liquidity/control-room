import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = signupSchema.parse(body);

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
        role: 'EDITOR',
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
