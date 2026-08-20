import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { campaignService } from '@/services/campaign.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

const bodySchema = z.object({
  disabled: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'campaign.launch');
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const { disabled } = bodySchema.parse(await req.json());
    const campaign = await campaignService.setAutoGenDisabled(
      params.id,
      disabled,
      session.user.id,
      ctx.projectId
    );
    return NextResponse.json(campaign);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/campaigns/[id]/disable-auto-gen error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
