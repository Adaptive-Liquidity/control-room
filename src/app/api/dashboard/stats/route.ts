import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';
import { agentService } from '@/services/agent.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const stats = await contentService.getDashboardStats();
    const [recentQueue, upcoming, agents] = await Promise.all([
      prisma.content.findMany({
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
      prisma.content.findMany({ where: { status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' }, take: 5 }),
      agentService.getAll(),
    ]);
    return NextResponse.json({ stats, recentQueue, upcoming, agents });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}