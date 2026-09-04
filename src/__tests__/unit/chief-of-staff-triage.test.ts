import { triageFounderRequest } from '@/lib/chief-of-staff/triage';

const base = {
  projectId: 'proj_flok',
  urgency: 3,
  impact: 3,
  effort: 3,
};

describe('Chief of Staff intake triage', () => {
  it('routes a request to the strongest specialist signal', () => {
    const result = triageFounderRequest({
      ...base,
      request: 'Research the competitor market and compare their positioning.',
    });

    expect(result.department).toBe('RESEARCH');
    expect(result.riskTier).toBe('LOW');
    expect(result.approvalRequired).toBe(false);
  });

  it('fails safely to founder review when no specialist signal matches', () => {
    const result = triageFounderRequest({ ...base, request: 'Help me think this through.' });

    expect(result.department).toBe('FOUNDER');
    expect(result.reasons[0]).toContain('clarification');
  });

  it('does not match short signals inside unrelated words', () => {
    const result = triageFounderRequest({ ...base, request: 'Review our product roadmap.' });

    expect(result.department).not.toBe('MARKETING');
  });

  it('requires approval for external customer communication', () => {
    const result = triageFounderRequest({
      ...base,
      request: 'Send email outreach to a new sales prospect.',
    });

    expect(result.department).toBe('SALES');
    expect(result.riskTier).toBe('HIGH');
    expect(result.approvalRequired).toBe(true);
  });

  it('classifies destructive or secret-handling actions as critical', () => {
    const result = triageFounderRequest({
      ...base,
      request: 'Delete database records using the production secret.',
    });

    expect(result.riskTier).toBe('CRITICAL');
    expect(result.approvalRequired).toBe(true);
  });

  it('scores priority from founder-supplied impact, urgency, and effort', () => {
    const now = triageFounderRequest({
      ...base,
      request: 'Fix the API bug.',
      impact: 5,
      urgency: 5,
      effort: 2,
    });
    const later = triageFounderRequest({
      ...base,
      request: 'Document an optional internal workflow.',
      impact: 1,
      urgency: 1,
      effort: 5,
    });

    expect(now).toMatchObject({ department: 'ENGINEERING', priorityScore: 13, priority: 'NOW' });
    expect(later).toMatchObject({ department: 'OPERATIONS', priorityScore: -2, priority: 'LATER' });
  });

  it('rejects malformed intake instead of guessing', () => {
    expect(() =>
      triageFounderRequest({ ...base, request: 'ok', urgency: 9 })
    ).toThrow();
  });
});
