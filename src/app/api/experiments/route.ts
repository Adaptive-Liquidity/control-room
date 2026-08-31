import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { ExperimentServiceError, experimentService } from '@/services/experiment.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  hypothesis: z.string().min(1).max(5000),
  channel: z.enum(['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG']).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        contentId: z.string().optional(),
      })
    )
    .min(2),
  primaryMetric: z.string().min(1).max(100),
  guardrailMetrics: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const { searchParams } = new URL(req.url);
    const result = await experimentService.getAll({
      projectId: ctx.projectId,
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/experiments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'content.edit');
    const data = createSchema.parse(await req.json());
    const experiment = await experimentService.create({
      ...data,
      createdById: session.user.id,
      projectId: ctx.projectId,
    });
    return NextResponse.json(experiment, { status: 201 });
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
    console.error('POST /api/experiments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
