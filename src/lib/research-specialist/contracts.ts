import { z } from 'zod';

const meaningfulText = z.string().trim().min(3).max(5_000);

export const researchSourceSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: meaningfulText,
  locator: meaningfulText,
  sourceType: z.enum(['PRIMARY', 'SECONDARY']),
  accessedAt: z.string().datetime().optional(),
});

export const researchEvidenceSchema = z.object({
  finding: meaningfulText,
  sourceIds: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export const researchRiskSchema = z.object({
  description: meaningfulText,
  likelihood: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  impact: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  mitigation: meaningfulText.optional(),
});

/**
 * Incomplete briefs are valid input. Readiness reports missing research inputs
 * so callers can ask for them without fabricating evidence or conclusions.
 */
export const researchBriefSchema = z.object({
  schemaVersion: z.literal('1'),
  projectId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  question: meaningfulText.optional(),
  evidence: z.array(researchEvidenceSchema).max(100).default([]),
  sources: z.array(researchSourceSchema).max(100).default([]),
  openQuestions: z.array(meaningfulText).max(50).default([]),
  risks: z.array(researchRiskSchema).max(50).default([]),
});

export const researchBriefReadinessSchema = z.object({
  status: z.enum(['BLOCKED', 'NEEDS_DISCOVERY', 'READY_FOR_REVIEW']),
  score: z.number().int().min(0).max(100),
  missingFields: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;
export type ResearchBriefReadiness = z.infer<typeof researchBriefReadinessSchema>;
