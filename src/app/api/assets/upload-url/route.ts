import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { AssetServiceError, assetService } from '@/services/asset.service';

export const runtime = 'nodejs';

const bodySchema = z.object({
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    requirePermission(session, 'content.edit');

    const body = bodySchema.parse(await req.json());
    const result = await assetService.createUploadUrl({
      userId: session.user.id,
      ...body,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof AssetServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/assets/upload-url error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
