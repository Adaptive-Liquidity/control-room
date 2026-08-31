import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError } from '@/lib/rbac';
import { AssetServiceError, assetService } from '@/services/asset.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  requireProjectPermission,
  resolveProjectContext,
} from '@/lib/project/context';

export const runtime = 'nodejs';

const bodySchema = z.object({
  storageKey: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sha256: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    requireProjectPermission(ctx, 'content.edit');

    const body = bodySchema.parse(await req.json());
    const result = await assetService.completeUpload({
      userId: session.user.id,
      projectId: ctx.projectId,
      ...body,
    });
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AssetServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/assets/complete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
