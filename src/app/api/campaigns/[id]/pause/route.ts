import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { campaignService } from '@/services/campaign.service';

const bodySchema = z.object({
  paused: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'campaign.launch');
    const { paused } = bodySchema.parse(await req.json());
    const campaign = await campaignService.setPaused(params.id, paused, session.user.id);
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/campaigns/[id]/pause error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
