import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { approvalService } from '@/services/approval.service';
import { ConflictError, ValidationServiceError } from '@/services/content.service';
import { channelSchema, contentTypeSchema } from '@/lib/n8n/contracts';

const bodySchema = z.object({
  revisionId: z.string().min(1),
  comment: z.string().optional(),
  edits: z
    .object({
      title: z.string().min(1).max(200).optional(),
      body: z.string().min(1).max(50000).optional(),
      channel: channelSchema.optional(),
      type: contentTypeSchema.optional(),
    })
    .optional(),
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
      decision: 'APPROVED',
      comment: body.comment,
      edits: body.edits,
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
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
