import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { assetService } from '@/services/asset.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const result = await assetService.list({
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
      mimePrefix: searchParams.get('mimePrefix') || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/assets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
