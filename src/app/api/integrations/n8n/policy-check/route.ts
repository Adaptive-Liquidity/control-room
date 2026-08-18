import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  UNSCOPED_POLICY_DECISION,
  evaluateCampaignPolicy,
} from '@/lib/n8n/campaign-policy';
import { n8nPolicyCheckSchema } from '@/lib/n8n/contracts';
import { SignatureError, verifyN8nHmac } from '@/lib/n8n/verify-signature';

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

    const payload = n8nPolicyCheckSchema.parse(JSON.parse(rawBody));

    if (!payload.campaignId) {
      return NextResponse.json(UNSCOPED_POLICY_DECISION, { status: 200 });
    }

    const decision = await evaluateCampaignPolicy(payload.campaignId);
    if (!decision) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json(decision, { status: 200 });
  } catch (error) {
    if (error instanceof SignatureError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    console.error('POST /api/integrations/n8n/policy-check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
