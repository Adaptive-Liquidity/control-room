import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { healthService } from '@/services/health.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const health = await healthService.getIntegrationHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error('GET /api/integrations/health error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
