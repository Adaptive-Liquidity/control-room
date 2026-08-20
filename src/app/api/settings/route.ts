import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
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

const SAFE_KEYS = new Set([
  'org.name',
  'org.epochDurationHours',
  'guardian.sensitivity',
  'guardian.autoBlockThreshold',
]);

const putSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const settings = await prisma.orgSetting.findMany({
      where: { key: { in: Array.from(SAFE_KEYS) } },
      orderBy: { key: 'asc' },
    });

    const map: Record<string, unknown> = {};
    for (const s of settings) map[s.key] = s.value;
    return NextResponse.json({ settings: map });
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'settings.manage');
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const body = putSchema.parse(await req.json());
    if (!SAFE_KEYS.has(body.key)) {
      return NextResponse.json({ error: `Setting key not allowed: ${body.key}` }, { status: 400 });
    }

    const setting = await prisma.orgSetting.upsert({
      where: { key: body.key },
      create: {
        key: body.key,
        value: body.value as never,
        updatedById: session.user.id,
      },
      update: {
        value: body.value as never,
        updatedById: session.user.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        projectId: ctx.projectId,
        type: 'SETTINGS_CHANGED',
        description: `Updated setting: ${body.key}`,
        metadata: { key: body.key },
      },
    });

    return NextResponse.json(setting);
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
    console.error('PUT /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
