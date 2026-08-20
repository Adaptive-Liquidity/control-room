import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

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

    const detail = await contentService.getDetail(params.id, ctx.projectId);
    if (!detail) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GET /api/content/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
