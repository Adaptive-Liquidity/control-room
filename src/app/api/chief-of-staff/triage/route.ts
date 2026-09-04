import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';
import { chiefOfStaffIntakeSchema } from '@/lib/chief-of-staff/contracts';
import { triageFounderRequest } from '@/lib/chief-of-staff/triage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = chiefOfStaffIntakeSchema.omit({ projectId: true });

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    if (ctx.role === 'SERVICE') {
      throw new ForbiddenError('SERVICE accounts cannot use Chief of Staff');
    }

    const body = bodySchema.parse(await req.json());
    const triage = triageFounderRequest({
      ...body,
      projectId: ctx.projectId,
    });

    return NextResponse.json({
      projectId: ctx.projectId,
      intake: {
        request: body.request,
        urgency: body.urgency,
        impact: body.impact,
        effort: body.effort,
      },
      triage,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('POST /api/chief-of-staff/triage error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
