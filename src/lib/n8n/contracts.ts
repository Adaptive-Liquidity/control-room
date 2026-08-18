import { z } from 'zod';

export const contentTypeSchema = z.enum([
  'TWITTER_THREAD',
  'BLOG_POST',
  'EMAIL',
  'PRESS_RELEASE',
  'AD_CREATIVE',
  'VIDEO_SCRIPT',
  'LINKEDIN_POST',
  'DISCORD_MESSAGE',
]);

export const channelSchema = z.enum(['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG']);

export const n8nDraftIngressSchema = z.object({
  schemaVersion: z.string().min(1),
  eventId: z.string().min(1).max(200),
  externalDraftId: z.string().min(1).max(200),
  workflowId: z.string().min(1).max(200),
  executionId: z.string().min(1).max(200),
  resumeUrl: z.string().url(),
  resumeExpiresAt: z.string().datetime().optional(),
  campaignId: z.string().optional(),
  content: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(50000),
    type: contentTypeSchema,
    channel: channelSchema,
  }),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nDraftIngress = z.infer<typeof n8nDraftIngressSchema>;

export const n8nPolicyCheckSchema = z.object({
  schemaVersion: z.string().min(1),
  campaignId: z.string().optional(),
});

export type N8nPolicyCheck = z.infer<typeof n8nPolicyCheckSchema>;

export const n8nPublishReceiptSchema = z.object({
  schemaVersion: z.string().min(1),
  eventId: z.string().min(1).max(200),
  contentId: z.string().min(1),
  revisionId: z.string().min(1),
  contentHash: z.string().min(1),
  executionId: z.string().min(1).max(200),
  channel: channelSchema,
  status: z.enum(['SUCCESS', 'FAILED']),
  platformPostId: z.string().optional(),
  platformUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nPublishReceipt = z.infer<typeof n8nPublishReceiptSchema>;

export const n8nResumePayloadSchema = z.object({
  schemaVersion: z.literal('1'),
  decision: z.enum(['APPROVED', 'REJECTED', 'REVISION_REQUESTED']),
  contentId: z.string(),
  revisionId: z.string(),
  contentHash: z.string(),
  title: z.string(),
  body: z.string(),
  channel: channelSchema,
  guardian: z.object({
    policyVersion: z.string(),
    score: z.number(),
  }),
  review: z.object({
    reviewerId: z.string(),
    decidedAt: z.string().datetime(),
    comment: z.string().nullable().optional(),
  }),
});

export type N8nResumePayload = z.infer<typeof n8nResumePayloadSchema>;

export const agentRunStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'WAITING_APPROVAL',
  'SUCCESS',
  'FAILED',
]);

export const n8nAgentRunIngressSchema = z.object({
  schemaVersion: z.string().min(1),
  eventId: z.string().min(1).max(200),
  workflowId: z.string().min(1).max(200),
  executionId: z.string().min(1).max(200),
  status: agentRunStatusSchema,
  agentId: z.string().optional(),
  agentName: z.string().max(200).optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  modelAlias: z.string().max(100).optional(),
  promptVersion: z.string().max(100).optional(),
  errorCode: z.string().max(100).optional(),
  errorMessage: z.string().max(2000).optional(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nAgentRunIngress = z.infer<typeof n8nAgentRunIngressSchema>;

export const n8nMetricSnapshotSchema = z.object({
  schemaVersion: z.string().min(1),
  eventId: z.string().min(1).max(200),
  contentId: z.string().optional(),
  campaignId: z.string().optional(),
  channel: channelSchema.optional(),
  observedAt: z.string().datetime(),
  impressions: z.number().int().nonnegative().optional(),
  engagements: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  signups: z.number().int().nonnegative().optional(),
  integrations: z.number().int().nonnegative().optional(),
  reach: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nMetricSnapshot = z.infer<typeof n8nMetricSnapshotSchema>;

export const attributionKindSchema = z.enum([
  'VIEW',
  'CLICK',
  'SIGNUP',
  'ACTIVATION',
  'INTEGRATION',
  'TREASURY',
]);

export const n8nAttributionIngressSchema = z.object({
  schemaVersion: z.string().min(1),
  eventId: z.string().min(1).max(200),
  kind: attributionKindSchema,
  contentId: z.string().optional(),
  campaignId: z.string().optional(),
  occurredAt: z.string().datetime(),
  value: z.number().optional(),
  currency: z.string().max(16).optional(),
  sessionId: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type N8nAttributionIngress = z.infer<typeof n8nAttributionIngressSchema>;
