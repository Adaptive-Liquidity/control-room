import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { agentService } from '@/services/agent.service';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 50;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const agent = await agentService.getById(params.id);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const requestedPage = parseInt(searchParams.get('page') || '1');
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const requestedLimit = parseInt(searchParams.get('limit') || String(MAX_LIMIT));
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(MAX_LIMIT, requestedLimit)
        : MAX_LIMIT;

    const runWhere = {
      OR: [
        { agentId: agent.id },
        { agentId: null, agentName: agent.name },
      ],
    };

    const [items, total] = await Promise.all([
      prisma.agentRun.findMany({
        where: runWhere,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.agentRun.count({ where: runWhere }),
    ]);

    return NextResponse.json({
      ...agent,
      runs: { items, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
