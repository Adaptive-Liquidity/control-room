import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { agentService } from '@/services/agent.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const agents = await agentService.getAll();
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}