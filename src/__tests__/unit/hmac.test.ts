import { createHmac } from 'crypto';
import { SignatureError, verifyN8nHmac } from '@/lib/n8n/verify-signature';

const SECRET = 'test-ingress-secret-for-hmac-verification';

function sign(rawBody: string, ts = Math.floor(Date.now() / 1000).toString()) {
  const signature = createHmac('sha256', SECRET)
    .update(`${ts}.${rawBody}`)
    .digest('hex');
  return { ts, signature };
}

describe('verifyN8nHmac', () => {
  it('accepts a valid signature', () => {
    const rawBody = '{"eventId":"e1"}';
    const { ts, signature } = sign(rawBody);
    expect(() =>
      verifyN8nHmac({
        secret: SECRET,
        timestampHeader: ts,
        signatureHeader: signature,
        rawBody,
      })
    ).not.toThrow();
  });

  it('accepts sha256= prefix', () => {
    const rawBody = '{}';
    const { ts, signature } = sign(rawBody);
    expect(() =>
      verifyN8nHmac({
        secret: SECRET,
        timestampHeader: ts,
        signatureHeader: `sha256=${signature}`,
        rawBody,
      })
    ).not.toThrow();
  });

  it('rejects bad signature', () => {
    const rawBody = '{"a":1}';
    const { ts } = sign(rawBody);
    expect(() =>
      verifyN8nHmac({
        secret: SECRET,
        timestampHeader: ts,
        signatureHeader: 'deadbeef'.repeat(8),
        rawBody,
      })
    ).toThrow(SignatureError);
  });

  it('rejects missing headers', () => {
    expect(() =>
      verifyN8nHmac({
        secret: SECRET,
        timestampHeader: null,
        signatureHeader: null,
        rawBody: '{}',
      })
    ).toThrow(/Missing signature/);
  });

  it('rejects empty secret', () => {
    expect(() =>
      verifyN8nHmac({
        secret: '',
        timestampHeader: '1',
        signatureHeader: 'abc',
        rawBody: '{}',
      })
    ).toThrow(/not configured/);
  });

  it('rejects timestamp outside skew', () => {
    const rawBody = '{}';
    const oldTs = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const signature = createHmac('sha256', SECRET)
      .update(`${oldTs}.${rawBody}`)
      .digest('hex');
    expect(() =>
      verifyN8nHmac({
        secret: SECRET,
        timestampHeader: oldTs,
        signatureHeader: signature,
        rawBody,
      })
    ).toThrow(/skew/);
  });
});
