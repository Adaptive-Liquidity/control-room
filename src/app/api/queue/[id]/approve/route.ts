import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { contentService } from '@/services/content.service';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { comment } = await req.json();
    const content = await contentService.approve(params.id, session.user.id as string, comment);
    return NextResponse.json(content);
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}