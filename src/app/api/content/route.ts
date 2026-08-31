// src/app/api/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import {
  ValidationServiceError,
  contentService,
} from '@/services/content.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  type: z.enum([
    'TWITTER_THREAD',
    'BLOG_POST',
    'EMAIL',
    'PRESS_RELEASE',
    'AD_CREATIVE',
    'VIDEO_SCRIPT',
    'LINKEDIN_POST',
    'DISCORD_MESSAGE',
  ]),
  channel: z.enum(['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG']),
  campaignId: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const { searchParams } = new URL(req.url);
    const options = {
      status: searchParams.get('status') || undefined,
      channel: searchParams.get('channel') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      projectId: ctx.projectId,
    };

    const result = await contentService.getAll(options);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/content error:', error);
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

    const body = await req.json();
    const validated = createSchema.parse(body);

    const content = await contentService.create({
      ...validated,
      authorId: session.user.id as string,
      projectId: ctx.projectId,
      origin: 'MANUAL',
    });

    return NextResponse.json(content, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ValidationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
