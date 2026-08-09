// src/app/api/content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  type: z.enum(['TWITTER_THREAD', 'BLOG_POST', 'EMAIL', 'PRESS_RELEASE', 'AD_CREATIVE', 'VIDEO_SCRIPT', 'LINKEDIN_POST', 'DISCORD_MESSAGE']),
  channel: z.enum(['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG']),
  campaignId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const options = {
      status: searchParams.get('status') || undefined,
      channel: searchParams.get('channel') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const result = await contentService.getAll(options);
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const validated = createSchema.parse(body);

    const content = await contentService.create({
      ...validated,
      authorId: session.user.id as string,
    });

    return NextResponse.json(content, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
