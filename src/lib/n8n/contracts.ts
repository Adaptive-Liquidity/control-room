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
