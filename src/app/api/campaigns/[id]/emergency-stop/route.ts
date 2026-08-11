import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { campaignService } from '@/services/campaign.service';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'campaign.launch');
    const campaign = await campaignService.emergencyStop(params.id, session.user.id);
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/campaigns/[id]/emergency-stop error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
