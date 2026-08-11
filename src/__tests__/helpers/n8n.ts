import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

export const INGRESS_SECRET = 'test-ingress-secret-for-hmac-verification';

export function signedHeaders(rawBody: string, secret = INGRESS_SECRET) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', secret)
    .update(`${ts}.${rawBody}`)
    .digest('hex');
  return {
    'content-type': 'application/json',
    'x-n8n-timestamp': ts,
    'x-n8n-signature': signature,
  };
}

export function makeJsonRequest(
  url: string,
  body: unknown,
  opts?: { secret?: string; badSig?: boolean }
): NextRequest {
  const rawBody = JSON.stringify(body);
  const headers = signedHeaders(rawBody, opts?.secret);
  if (opts?.badSig) {
    headers['x-n8n-signature'] = '00'.repeat(32);
  }
  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

export function session(role: string, id = 'reviewer-1') {
  return {
    expires: new Date(Date.now() + 3600_000).toISOString(),
    user: {
      id,
      email: `${role}@test.local`,
      name: role,
      role,
    },
  };
}
