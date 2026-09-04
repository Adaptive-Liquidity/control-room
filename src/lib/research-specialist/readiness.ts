import {
  researchBriefSchema,
  type ResearchBrief,
  type ResearchBriefReadiness,
} from './contracts';

type ReadinessField = 'question' | 'evidence' | 'sources' | 'openQuestions' | 'risks';

const WEIGHTS: Record<ReadinessField, number> = {
  question: 35,
  evidence: 25,
  sources: 20,
  openQuestions: 10,
  risks: 10,
};

const RECOMMENDATIONS: Record<ReadinessField, string> = {
  question: 'Define the specific, answerable research question.',
  evidence: 'Record at least one evidence-backed finding without inventing a conclusion.',
  sources: 'Add at least one identifiable primary or secondary source.',
  openQuestions: 'Record unresolved questions, or explicitly state that none remain.',
  risks: 'Record research limitations or decision risks, or explicitly state that none are known.',
};

const DISCOVERY_FIELDS: ReadinessField[] = ['evidence', 'sources'];

function hasValue(brief: ResearchBrief, field: ReadinessField) {
  const value = brief[field];
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

export function evaluateResearchBrief(raw: unknown): ResearchBriefReadiness {
  const brief = researchBriefSchema.parse(raw);
  const fields = Object.keys(WEIGHTS) as ReadinessField[];
  const missingFields = fields.filter((field) => !hasValue(brief, field));
  const score = fields.reduce(
    (total, field) => total + (missingFields.includes(field) ? 0 : WEIGHTS[field]),
    0
  );
  const questionMissing = missingFields.includes('question');
  const discoveryMissing = DISCOVERY_FIELDS.some((field) => missingFields.includes(field));

  return {
    status: questionMissing
      ? 'BLOCKED'
      : discoveryMissing
        ? 'NEEDS_DISCOVERY'
        : 'READY_FOR_REVIEW',
    score,
    missingFields,
    recommendations: missingFields.map((field) => RECOMMENDATIONS[field]),
  };
}
