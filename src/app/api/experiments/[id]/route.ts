import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { scopedPrisma } from '@/lib/scope/scoped-prisma';
import { ExperimentServiceError, experimentService } from '@/services/experiment.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  hypothesis: z.string().min(1).max(5000).optional(),
  channel: z.enum(['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG']).nullable().optional(),
  status: z.enum(['PLANNING', 'RUNNING', 'COMPLETE', 'CANCELLED']).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        contentId: z.string().optional(),
      })
    )
    .min(2)
    .optional(),
  primaryMetric: z.string().min(1).max(100).optional(),
  guardrailMetrics: z.array(z.string()).optional(),
  outcome: z.string().max(2000).nullable().optional(),
  decision: z.string().max(2000).nullable().optional(),
  liftPct: z.number().nullable().optional(),
  confidencePct: z.number().min(0).max(100).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const experiment = await scopedPrisma(ctx.projectId, prisma).experiment.findUnique({
      where: { id: params.id },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });
    if (!experiment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(experiment);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/experiments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'content.edit');
    const data = updateSchema.parse(await req.json());
    const experiment = await experimentService.update(params.id, {
      ...data,
      userId: session.user.id,
    }, ctx.projectId);
    return NextResponse.json(experiment);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ExperimentServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('PATCH /api/experiments/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
