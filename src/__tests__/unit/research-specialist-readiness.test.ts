import { evaluateResearchBrief } from '@/lib/research-specialist/readiness';

const completeBrief = {
  schemaVersion: '1' as const,
  projectId: 'proj_flok',
  title: 'Founder onboarding research',
  question: 'Which setup decisions prevent solo founders from launching their first campaign?',
  evidence: [
    {
      finding: 'Participants paused when required campaign inputs were not explained.',
      sourceIds: ['interviews-2026-08'],
      confidence: 'MEDIUM' as const,
    },
  ],
  sources: [
    {
      id: 'interviews-2026-08',
      title: 'Moderated founder onboarding interviews',
      locator: 'Internal research archive, August 2026',
      sourceType: 'PRIMARY' as const,
      accessedAt: '2026-09-04T00:00:00.000Z',
    },
  ],
  openQuestions: ['Does the highest-friction decision change by campaign channel?'],
  risks: [
    {
      description: 'The initial participant group may overrepresent first-time founders.',
      likelihood: 'MEDIUM' as const,
      impact: 'MEDIUM' as const,
      mitigation: 'Recruit experienced founders in the next interview round.',
    },
  ],
};

describe('Research Specialist brief readiness', () => {
  it('marks a complete research brief ready for review', () => {
    expect(evaluateResearchBrief(completeBrief)).toEqual({
      status: 'READY_FOR_REVIEW',
      score: 100,
      missingFields: [],
      recommendations: [],
    });
  });

  it('blocks when the core research question is missing', () => {
    const { question: _question, ...brief } = completeBrief;
    const result = evaluateResearchBrief(brief);

    expect(result.status).toBe('BLOCKED');
    expect(result.score).toBe(65);
    expect(result.missingFields).toContain('question');
  });

  it('requires discovery when evidence is missing', () => {
    const result = evaluateResearchBrief({ ...completeBrief, evidence: [] });

    expect(result).toMatchObject({
      status: 'NEEDS_DISCOVERY',
      score: 75,
      missingFields: ['evidence'],
    });
    expect(result.recommendations[0]).toContain('evidence-backed');
  });

  it('requires discovery when sources are missing', () => {
    const result = evaluateResearchBrief({ ...completeBrief, sources: [] });

    expect(result).toMatchObject({
      status: 'NEEDS_DISCOVERY',
      score: 80,
      missingFields: ['sources'],
    });
  });

  it('reports open questions and risks without blocking review', () => {
    const result = evaluateResearchBrief({ ...completeBrief, openQuestions: [], risks: [] });

    expect(result.status).toBe('READY_FOR_REVIEW');
    expect(result.score).toBe(80);
    expect(result.missingFields).toEqual(['openQuestions', 'risks']);
    expect(result.recommendations).toHaveLength(2);
  });

  it('accepts an incomplete brief without inventing missing content', () => {
    const result = evaluateResearchBrief({
      schemaVersion: '1',
      projectId: 'proj_flok',
      title: 'Possible research',
    });

    expect(result.status).toBe('BLOCKED');
    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual([
      'question',
      'evidence',
      'sources',
      'openQuestions',
      'risks',
    ]);
  });

  it('rejects malformed evidence instead of treating it as verified', () => {
    expect(() =>
      evaluateResearchBrief({
        ...completeBrief,
        evidence: [{ finding: 'Users want it', sourceIds: [], confidence: 'CERTAIN' }],
      })
    ).toThrow();
  });
});
