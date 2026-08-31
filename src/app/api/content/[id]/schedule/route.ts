import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';
import {
  ConflictError,
  ValidationServiceError,
  contentService,
} from '@/services/content.service';

const bodySchema = z.object({
  scheduledAt: z.string().datetime(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'content.approve');

    const { scheduledAt } = bodySchema.parse(await req.json());
    const existing = await contentService.getById(params.id, ctx.projectId);
    if (!existing) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const content = await contentService.schedule(
      params.id,
      new Date(scheduledAt),
      ctx.projectId
    );
    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ConflictError || error instanceof ValidationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/content/[id]/schedule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
