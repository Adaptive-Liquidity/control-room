import { z } from 'zod';

const meaningfulText = z.string().trim().min(3).max(5_000);

export const productEvidenceSchema = z.object({
  claim: meaningfulText,
  source: meaningfulText,
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export const productRiskSchema = z.object({
  description: meaningfulText,
  likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  mitigation: meaningfulText.optional(),
});

/**
 * Intentionally accepts incomplete briefs. The readiness evaluator reports gaps
 * so the Product Specialist asks the founder instead of fabricating answers.
 */
export const productBriefSchema = z.object({
  schemaVersion: z.literal('1'),
  projectId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  problem: meaningfulText.optional(),
  targetUser: meaningfulText.optional(),
  desiredOutcome: meaningfulText.optional(),
  evidence: z.array(productEvidenceSchema).max(50).default([]),
  acceptanceCriteria: z.array(meaningfulText).max(50).default([]),
  dependencies: z.array(meaningfulText).max(50).default([]),
  risks: z.array(productRiskSchema).max(50).default([]),
  openQuestions: z.array(meaningfulText).max(50).default([]),
});

export const productBriefReadinessSchema = z.object({
  status: z.enum(['BLOCKED', 'NEEDS_DISCOVERY', 'READY_FOR_REVIEW']),
  score: z.number().int().min(0).max(100),
  missingFields: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ProductBrief = z.infer<typeof productBriefSchema>;
export type ProductBriefReadiness = z.infer<typeof productBriefReadinessSchema>;
