import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { approvalService } from '@/services/approval.service';
import { ConflictError, ValidationServiceError } from '@/services/content.service';

const bodySchema = z.object({
  revisionId: z.string().min(1),
  comment: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = bodySchema.parse(await req.json());
    const content = await approvalService.decide({
      session,
      contentId: params.id,
      expectedRevisionId: body.revisionId,
      decision: 'REVISION_REQUESTED',
      comment: body.comment,
    });
    return NextResponse.json(content);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof ValidationServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Request-revision error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
