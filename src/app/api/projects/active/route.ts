import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ACTIVE_PROJECT_COOKIE } from '@/lib/project/context';

const activeSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = activeSchema.parse(await req.json());
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId: body.projectId, userId: session.user.id },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden project' }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastActiveProjectId: body.projectId },
    });

    const res = NextResponse.json({ ok: true, projectId: body.projectId });
    res.cookies.set(ACTIVE_PROJECT_COOKIE, body.projectId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/projects/active error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
