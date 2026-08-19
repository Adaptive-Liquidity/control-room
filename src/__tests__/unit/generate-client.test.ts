import { callN8nGenerate, generateResponseSchema } from '@/lib/n8n/generate-client';

describe('generate-client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.N8N_GENERATE_WEBHOOK_URL;
    delete process.env.N8N_GENERATE_SECRET;
    delete process.env.N8N_INGRESS_SECRET;
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
});
