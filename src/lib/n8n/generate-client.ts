import { createHmac } from "crypto";
import { z } from "zod";

export const generateRequestSchema = z.object({
  channel: z.enum(["TWITTER", "LINKEDIN", "DISCORD", "EMAIL", "BLOG"]),
  type: z.enum([
    "TWITTER_THREAD",
    "BLOG_POST",
    "EMAIL",
    "PRESS_RELEASE",
    "AD_CREATIVE",
    "VIDEO_SCRIPT",
    "LINKEDIN_POST",
    "DISCORD_MESSAGE",
  ]),
  prompt: z.string().max(2000).optional(),
  titleHint: z.string().max(200).optional(),
  projectId: z.string().optional(),
  campaignId: z.string().optional(),
  contextPack: z.unknown().optional(),
  composedHash: z.string().optional(),
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const generateResponseSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  type: z.string().optional(),
  channel: z.string().optional(),
});

export type GenerateResponse = z.infer<typeof generateResponseSchema>;

export async function callN8nGenerate(
  payload: GenerateRequest
): Promise<{ ok: true; data: GenerateResponse } | { ok: false; error: string; status?: number }> {
  const url = process.env.N8N_GENERATE_WEBHOOK_URL;
  const secret = process.env.N8N_GENERATE_SECRET ?? process.env.N8N_INGRESS_SECRET;

  if (!url) return { ok: false, error: "N8N_GENERATE_WEBHOOK_URL is not configured" };
  if (!secret) return { ok: false, error: "N8N_GENERATE_SECRET (or N8N_INGRESS_SECRET) is not set" };

  const body = JSON.stringify({
    schemaVersion: "1",
    ...payload,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-Timestamp": timestamp,
        "X-N8N-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(90_000),
    });

    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: `Generate webhook HTTP ${res.status}: ${text.slice(0, 500)}`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: "Generate webhook returned non-JSON" };
    }

    const data = generateResponseSchema.safeParse(parsed);
    if (!data.success) {
      return { ok: false, error: "Generate webhook returned invalid shape (expected title + body)" };
    }

    return { ok: true, data: data.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generate request failed";
    return { ok: false, error: message };
  }
}
