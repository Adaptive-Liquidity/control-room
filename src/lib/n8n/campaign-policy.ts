import type { ContentRiskTier, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class CampaignPolicyRejectedError extends Error {
  readonly reason: CampaignPolicyReason;

  constructor(reason: CampaignPolicyReason) {
    super(`Campaign policy rejected: ${reason}`);
    this.name = 'CampaignPolicyRejectedError';
    this.reason = reason;
  }
}

export type CampaignPolicyReason =
  | 'emergency_stopped'
  | 'auto_gen_disabled'
  | 'paused'
  | 'daily_content_limit'
  | 'no_context_pack'
  | 'project_archived';

export interface CampaignPolicyDecision {
  allowed: boolean;
  reason: CampaignPolicyReason | null;
  remainingContentToday: number | null;
  remainingPublishToday: number | null;
  requireHuman: boolean;
}

/** Decision returned when no campaign is attached: nothing to enforce, human still required. */
export const UNSCOPED_POLICY_DECISION: CampaignPolicyDecision = {
  allowed: true,
  reason: null,
  remainingContentToday: null,
  remainingPublishToday: null,
  requireHuman: true,
};

const RISK_RANK: Record<ContentRiskTier, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function asPolicy(approvalPolicy: unknown): {
  requireHuman?: boolean;
  autoApproveBelow?: ContentRiskTier;
  riskCeiling?: ContentRiskTier;
} {
  if (approvalPolicy && typeof approvalPolicy === 'object' && !Array.isArray(approvalPolicy)) {
    return approvalPolicy as {
      requireHuman?: boolean;
      autoApproveBelow?: ContentRiskTier;
      riskCeiling?: ContentRiskTier;
    };
  }
  return {};
}

export function resolveRequireHuman(
  approvalPolicy: unknown,
  contentRisk?: ContentRiskTier | null
): boolean {
  const policy = asPolicy(approvalPolicy);

  const rawAuto = policy.autoApproveBelow;
  const rawCeiling = policy.riskCeiling;
  const autoApproveBelow =
    rawAuto && rawAuto in RISK_RANK ? (rawAuto as ContentRiskTier) : undefined;
  const riskCeiling =
    rawCeiling && rawCeiling in RISK_RANK ? (rawCeiling as ContentRiskTier) : undefined;

  // Fail closed: unrecognized tier strings cannot disable human review.
  if (
    (rawAuto != null && !autoApproveBelow) ||
    (rawCeiling != null && !riskCeiling)
  ) {
    return true;
  }

  // Ceiling always wins: content above the campaign risk ceiling needs a human.
  if (contentRisk && riskCeiling && RISK_RANK[contentRisk] > RISK_RANK[riskCeiling]) {
    return true;
  }

  if (typeof policy.requireHuman === 'boolean' && policy.requireHuman === true) {
    return true;
  }

  if (contentRisk && autoApproveBelow) {
    if (RISK_RANK[contentRisk] <= RISK_RANK[autoApproveBelow]) {
      return false;
    }
  }

  if (typeof policy.requireHuman === 'boolean') return policy.requireHuman;
  return true;
}

/**
 * Evaluates campaign kill-switches and daily quotas for n8n-originated work.
 * Returns null when the campaign does not exist so callers pick their own status code.
 */
export async function evaluateCampaignPolicy(
  campaignId: string,
  tx?: Prisma.TransactionClient,
  opts?: { contentRisk?: ContentRiskTier | null }
): Promise<CampaignPolicyDecision | null> {
  const db = tx ?? prisma;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      approvalPolicy: true,
      dailyContentLimit: true,
      dailyPublishLimit: true,
      paused: true,
      autoGenDisabled: true,
      emergencyStopped: true,
      project: {
        select: {
          status: true,
          activeContextVersionId: true,
          company: { select: { activeContextVersionId: true } },
        },
      },
    },
  });

  if (!campaign) return null;

  const dayStart = startOfUtcDay();
  const [contentToday, publishedToday] = await Promise.all([
    db.content.count({
      where: { campaignId, origin: 'N8N', createdAt: { gte: dayStart } },
    }),
    db.content.count({
      where: { campaignId, status: 'PUBLISHED', publishedAt: { gte: dayStart } },
    }),
  ]);

  const shared = {
    remainingContentToday:
      campaign.dailyContentLimit != null
        ? Math.max(0, campaign.dailyContentLimit - contentToday)
        : null,
    remainingPublishToday:
      campaign.dailyPublishLimit != null
        ? Math.max(0, campaign.dailyPublishLimit - publishedToday)
        : null,
    requireHuman: resolveRequireHuman(campaign.approvalPolicy, opts?.contentRisk),
  };

  if (campaign.project.status === 'ARCHIVED') {
    return { allowed: false, reason: 'project_archived', ...shared };
  }
  if (
    !campaign.project.activeContextVersionId ||
    !campaign.project.company.activeContextVersionId
  ) {
    return { allowed: false, reason: 'no_context_pack', ...shared };
  }
  if (campaign.emergencyStopped) {
    return { allowed: false, reason: 'emergency_stopped', ...shared };
  }
  if (campaign.autoGenDisabled) {
    return { allowed: false, reason: 'auto_gen_disabled', ...shared };
  }
  if (campaign.paused) {
    return { allowed: false, reason: 'paused', ...shared };
  }
  if (campaign.dailyContentLimit != null && contentToday >= campaign.dailyContentLimit) {
    return {
      allowed: false,
      reason: 'daily_content_limit',
      ...shared,
      remainingContentToday: 0,
    };
  }

  return { allowed: true, reason: null, ...shared };
}
