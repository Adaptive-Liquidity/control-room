import { evaluateProductBrief } from '@/lib/product-specialist/readiness';

const completeBrief = {
  schemaVersion: '1' as const,
  projectId: 'proj_flok',
  title: 'Guided campaign setup',
  problem: 'Solo founders do not know which campaign inputs are required before generation.',
  targetUser: 'Solo founders launching their first product campaign.',
  desiredOutcome: 'A founder can create a review-ready campaign brief without expert assistance.',
  evidence: [
    {
      claim: 'Founders abandon setup when required inputs are unclear.',
      source: 'Five moderated onboarding interviews from August 2026.',
      confidence: 'MEDIUM' as const,
    },
  ],
  acceptanceCriteria: ['A founder can complete every required field with guided explanations.'],
  dependencies: ['Published company and project context packs.'],
  risks: [
    {
      description: 'Suggestions may sound authoritative when supporting evidence is weak.',
      likelihood: 'MEDIUM' as const,
      impact: 'HIGH' as const,
      mitigation: 'Label suggestions and require founder approval before saving them.',
    },
  ],
  openQuestions: ['Should guidance adapt to campaign channel?'],
};

describe('Product Specialist brief readiness', () => {
  it('marks a complete product brief ready for review', () => {
    expect(evaluateProductBrief(completeBrief)).toEqual({
      status: 'READY_FOR_REVIEW',
      score: 100,
      missingFields: [],
      recommendations: [],
    });
  });

  it('blocks when a core problem field is missing', () => {
    const { problem: _problem, ...brief } = completeBrief;
    const result = evaluateProductBrief(brief);

    expect(result.status).toBe('BLOCKED');
    expect(result.score).toBe(80);
    expect(result.missingFields).toContain('problem');
  });

  it('requires evidence before a brief is ready for review', () => {
    const result = evaluateProductBrief({ ...completeBrief, evidence: [] });

    expect(result).toMatchObject({
      status: 'NEEDS_DISCOVERY',
      score: 85,
      missingFields: ['evidence'],
    });
    expect(result.recommendations[0]).toContain('source');
  });

  it('requires observable acceptance criteria', () => {
    const result = evaluateProductBrief({ ...completeBrief, acceptanceCriteria: [] });

    expect(result.status).toBe('NEEDS_DISCOVERY');
    expect(result.missingFields).toContain('acceptanceCriteria');
  });

  it('treats dependencies and risks as explicit decisions', () => {
    const result = evaluateProductBrief({ ...completeBrief, dependencies: [], risks: [] });

    expect(result.score).toBe(90);
    expect(result.missingFields).toEqual(['dependencies', 'risks']);
    expect(result.recommendations).toHaveLength(2);
  });

  it('accepts an incomplete brief without inventing missing content', () => {
    const result = evaluateProductBrief({
      schemaVersion: '1',
      projectId: 'proj_flok',
      title: 'Possible feature',
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.score).toBe(0);
    expect(result.missingFields).toHaveLength(7);
  });

  it('rejects malformed evidence instead of treating it as verified', () => {
    expect(() =>
      evaluateProductBrief({
        ...completeBrief,
        evidence: [{ claim: 'Users want it', source: '', confidence: 'CERTAIN' }],
      })
    ).toThrow();
  });
});
