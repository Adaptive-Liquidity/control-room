import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';
import { agentService } from '@/services/agent.service';
import { prisma } from '@/lib/prisma';
import { scopedPrisma } from '@/lib/scope/scoped-prisma';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const db = scopedPrisma(ctx.projectId, prisma);
    const stats = await contentService.getDashboardStats(ctx.projectId);
    const [recentQueue, upcoming, agents] = await Promise.all([
      db.content.findMany({
        where: { status: 'PENDING_REVIEW' },
        select: {
          id: true,
          title: true,
          channel: true,
          status: true,
          origin: true,
          guardianScore: true,
          currentRevisionId: true,
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.content.findMany({ where: { status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' }, take: 5 }),
      agentService.getAll(ctx.projectId),
    ]);
    return NextResponse.json({ stats, recentQueue, upcoming, agents });
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}