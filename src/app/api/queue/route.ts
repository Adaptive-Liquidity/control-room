import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');
    // Default to pending review; pass status=all (or empty) for unfiltered list.
    const status =
      statusParam === null
        ? 'PENDING_REVIEW'
        : statusParam === 'all' || statusParam === ''
          ? undefined
          : statusParam;
    const result = await contentService.getAll({
      status,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}