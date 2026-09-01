import { callN8nGenerate, generateResponseSchema } from '@/lib/n8n/generate-client';

describe('generate-client', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.N8N_GENERATE_WEBHOOK_URL;
    delete process.env.N8N_GENERATE_SECRET;
    delete process.env.N8N_INGRESS_SECRET;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns error when webhook URL is missing', async () => {
    process.env.N8N_INGRESS_SECRET = 'test-secret';
    const result = await callN8nGenerate({
      channel: 'TWITTER',
      type: 'TWITTER_THREAD',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('N8N_GENERATE_WEBHOOK_URL');
    }
  });

  it('validates generate response schema', () => {
    const parsed = generateResponseSchema.safeParse({
      title: 'Hello',
      body: 'World',
    });
    expect(parsed.success).toBe(true);
  });

  it('sends HMAC signature and Header Auth on generate requests', async () => {
    process.env.N8N_GENERATE_WEBHOOK_URL = 'https://n8n.example/webhook/aeon-studio-generate';
    process.env.N8N_GENERATE_SECRET = 'generate-secret';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ title: 'T', body: 'B' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callN8nGenerate({
      channel: 'TWITTER',
      type: 'TWITTER_THREAD',
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-AEON-Generate-Auth']).toBe('generate-secret');
    expect(headers['X-N8N-Signature']).toMatch(/^[a-f0-9]{64}$/);
    expect(headers['X-N8N-Timestamp']).toMatch(/^\d+$/);
  });

  it('does not send N8N_INGRESS_SECRET as generate Header Auth', async () => {
    process.env.N8N_GENERATE_WEBHOOK_URL = 'https://n8n.example/webhook/aeon-studio-generate';
    process.env.N8N_INGRESS_SECRET = 'ingress-secret';
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callN8nGenerate({
      channel: 'TWITTER',
      type: 'TWITTER_THREAD',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('N8N_GENERATE_SECRET');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
