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

const riskTierSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const approvalPolicySchema = z
  .object({
    requireHuman: z.boolean().optional(),
    autoApproveBelow: riskTierSchema.optional(),
    riskCeiling: riskTierSchema.optional(),
  })
  .strict()
  .optional();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  theme: z.enum([
    'CONTROL_PLANE',
    'BUILD_AGENTS',
    'COMPLIANT_ARCHITECTURE',
    'THE_FLYWHEEL',
    'CUSTOM',
  ]),
  audience: z.enum([
    'TIER_1_AGENTS',
    'TIER_2_DEFI',
    'TIER_3_INFRASTRUCTURE',
    'TIER_4_ENTERPRISE',
    'ALL',
  ]),
  startDate: z.string().datetime().or(z.string().min(1)),
  endDate: z.string().datetime().or(z.string().min(1)).optional(),
  budget: z.number().nonnegative().optional(),
  objective: z.string().max(500).optional(),
  thesis: z.string().max(5000).optional(),
  approvalPolicy: approvalPolicySchema,
  dailyContentLimit: z.number().int().positive().optional(),
  dailyPublishLimit: z.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const { searchParams } = new URL(req.url);
    const result = await campaignService.getAll({
      status: searchParams.get('status') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      projectId: ctx.projectId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Campaigns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'campaign.launch');
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const data = createSchema.parse(await req.json());
    const campaign = await campaignService.create({
      ...data,
      creatorId: session.user.id,
      projectId: ctx.projectId,
    });
    return NextResponse.json(campaign, { status: 201 });
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
    console.error('Create campaign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
