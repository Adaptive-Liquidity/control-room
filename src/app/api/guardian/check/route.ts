import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { guardianService } from '@/lib/guardian/guardian.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const { title, body } = await req.json();
    if (!body) return NextResponse.json({ error: 'Body is required' }, { status: 400 });
    const result = await guardianService.checkContent(body, title || '', {
      companyId: ctx.company.id,
      projectId: ctx.projectId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Guardian check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}