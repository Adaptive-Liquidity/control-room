import { researchReadinessForTriage } from '@/lib/chief-of-staff/research-gate';

describe('researchReadinessForTriage', () => {
  it('returns null unless the department is RESEARCH', () => {
    expect(
      researchReadinessForTriage(
        'proj_aeon',
        'Write a product requirement for the onboarding feature.',
        'PRODUCT'
      )
    ).toBeNull();
  });

  it('does not invent a brief; RESEARCH intake is blocked until a question exists', () => {
    const result = researchReadinessForTriage(
      'proj_aeon',
      'Research the competitor market and compare their positioning.',
      'RESEARCH'
    );
    expect(result).toMatchObject({ status: 'BLOCKED', score: 0 });
    expect(result?.missingFields).toContain('question');
  });
});
