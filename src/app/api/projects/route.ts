import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  resolveProjectContext,
  SetupRequiredError,
  ForbiddenProjectError,
} from '@/lib/project/context';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await resolveProjectContext({ requireReady: false });
    return NextResponse.json({
      activeProjectId: ctx.projectId,
      company: ctx.company,
      projects: ctx.projects,
    });
  } catch (error) {
    if (error instanceof SetupRequiredError) {
      return NextResponse.json({ projects: [], needsSetup: true });
    }
    if (error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
