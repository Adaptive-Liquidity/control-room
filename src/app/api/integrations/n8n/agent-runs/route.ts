import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { n8nAgentRunIngressSchema } from '@/lib/n8n/contracts';
import { SignatureError, assertEventIdUnused, verifyN8nHmac } from '@/lib/n8n/verify-signature';
import { emitAgentRunUpdated } from '@/lib/pusher/server';
import { agentRunService } from '@/services/agent-run.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    verifyN8nHmac({
      secret: process.env.N8N_INGRESS_SECRET ?? '',
      timestampHeader: req.headers.get('x-n8n-timestamp'),
      signatureHeader: req.headers.get('x-n8n-signature'),
      rawBody,
    });

    const payload = n8nAgentRunIngressSchema.parse(JSON.parse(rawBody));

    const existing = await prisma.agentRun.findUnique({ where: { eventId: payload.eventId } });
    if (existing) {
      return NextResponse.json(
        { runId: existing.id, status: existing.status, idempotent: true },
        { status: 200 }
      );
    }

    await assertEventIdUnused(payload.eventId);

    const { run, idempotent } = await agentRunService.ingest(payload);
    if (!idempotent) {
      await emitAgentRunUpdated({
        agentRunId: run.id,
        agentId: run.agentId ?? undefined,
        status: run.status,
      });
    }
    return NextResponse.json(
      { runId: run.id, status: run.status, idempotent },
      { status: idempotent ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof SignatureError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    console.error('POST /api/integrations/n8n/agent-runs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
