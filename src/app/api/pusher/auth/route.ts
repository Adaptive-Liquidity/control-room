import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { CONTROL_ROOM_CHANNEL } from '@/lib/pusher/constants';
import { getPusherServer } from '@/lib/pusher/server';

export const runtime = 'nodejs';

/**
 * Authorizes subscription to private-control-room only.
 * Requires an authenticated NextAuth session.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pusher = getPusherServer();
    if (!pusher) {
      return NextResponse.json(
        { error: 'Pusher not configured' },
        { status: 503 }
      );
    }

    const contentType = req.headers.get('content-type') ?? '';
    let socketId = '';
    let channelName = '';

    if (contentType.includes('application/json')) {
      const body = (await req.json()) as {
        socket_id?: string;
        channel_name?: string;
      };
      socketId = String(body.socket_id ?? '');
      channelName = String(body.channel_name ?? '');
    } else {
      const form = await req.formData();
      socketId = String(form.get('socket_id') ?? '');
      channelName = String(form.get('channel_name') ?? '');
    }

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'socket_id and channel_name required' },
        { status: 400 }
      );
    }

    if (channelName !== CONTROL_ROOM_CHANNEL) {
      return NextResponse.json({ error: 'Forbidden channel' }, { status: 403 });
    }

    const auth = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  } catch (error) {
    console.error('POST /api/pusher/auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
