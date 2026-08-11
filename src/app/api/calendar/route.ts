import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!fromParam || !toParam) {
      return NextResponse.json({ error: 'from and to query params are required (ISO dates)' }, { status: 400 });
    }

    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Invalid from/to dates' }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: 'from must be <= to' }, { status: 400 });
    }

    const [contentEvents, campaigns] = await Promise.all([
      prisma.content.findMany({
        where: {
          OR: [
            { scheduledAt: { gte: from, lte: to } },
            { publishedAt: { gte: from, lte: to } },
          ],
        },
        select: {
          id: true,
          title: true,
          channel: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          campaignId: true,
        },
        orderBy: [{ scheduledAt: 'asc' }, { publishedAt: 'asc' }],
      }),
      prisma.campaign.findMany({
        where: {
          startDate: { lte: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          endDate: true,
          paused: true,
          emergencyStopped: true,
        },
      }),
    ]);

    const events = contentEvents.map((c) => ({
      id: c.id,
      title: c.title,
      date: (c.scheduledAt ?? c.publishedAt)!.toISOString(),
      channel: c.channel,
      status: c.status,
      contentId: c.id,
      campaignId: c.campaignId,
      kind: 'content' as const,
    }));

    const campaignWindows = campaigns.map((c) => ({
      id: `campaign-${c.id}`,
      title: c.name,
      date: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      status: c.status,
      campaignId: c.id,
      paused: c.paused,
      emergencyStopped: c.emergencyStopped,
      kind: 'campaign' as const,
    }));

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      events,
      campaigns: campaignWindows,
    });
  } catch (error) {
    console.error('GET /api/calendar error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
