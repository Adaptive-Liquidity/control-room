import {
  productBriefSchema,
  type ProductBrief,
  type ProductBriefReadiness,
} from './contracts';

type ReadinessField =
  | 'problem'
  | 'targetUser'
  | 'desiredOutcome'
  | 'evidence'
  | 'acceptanceCriteria'
  | 'dependencies'
  | 'risks';

const WEIGHTS: Record<ReadinessField, number> = {
  problem: 20,
  targetUser: 20,
  desiredOutcome: 20,
  evidence: 15,
  acceptanceCriteria: 15,
  dependencies: 5,
  risks: 5,
};

const RECOMMENDATIONS: Record<ReadinessField, string> = {
  problem: 'Describe the specific user problem without prescribing a solution.',
  targetUser: 'Identify the primary user segment affected by the problem.',
  desiredOutcome: 'Define the observable user or business outcome this work should create.',
  evidence: 'Add at least one source supporting the problem or its importance.',
  acceptanceCriteria: 'Add at least one observable condition that defines success.',
  dependencies: 'Record dependencies, or explicitly state that none are known.',
  risks: 'Record delivery or product risks, or explicitly state that none are known.',
};

const CORE_FIELDS: ReadinessField[] = ['problem', 'targetUser', 'desiredOutcome'];
const REVIEW_FIELDS: ReadinessField[] = ['evidence', 'acceptanceCriteria'];

function hasValue(brief: ProductBrief, field: ReadinessField) {
  const value = brief[field];
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

export function evaluateProductBrief(raw: unknown): ProductBriefReadiness {
  const brief = productBriefSchema.parse(raw);
  const fields = Object.keys(WEIGHTS) as ReadinessField[];
  const missingFields = fields.filter((field) => !hasValue(brief, field));
  const score = fields.reduce(
    (total, field) => total + (missingFields.includes(field) ? 0 : WEIGHTS[field]),
    0
  );
  const coreMissing = CORE_FIELDS.some((field) => missingFields.includes(field));
  const reviewMissing = REVIEW_FIELDS.some((field) => missingFields.includes(field));

  return {
    status: coreMissing
      ? 'BLOCKED'
      : reviewMissing || score < 75
        ? 'NEEDS_DISCOVERY'
        : 'READY_FOR_REVIEW',
    score,
    missingFields,
    recommendations: missingFields.map((field) => RECOMMENDATIONS[field]),
  };
}
