import { productReadinessForTriage } from '@/lib/chief-of-staff/product-gate';

describe('productReadinessForTriage', () => {
  it('returns null unless the department is PRODUCT', () => {
    expect(
      productReadinessForTriage('proj_aeon', 'Research the competitor market.', 'RESEARCH')
    ).toBeNull();
  });

  it('does not invent a brief; PRODUCT intake is blocked until core fields exist', () => {
    const result = productReadinessForTriage(
      'proj_aeon',
      'Write a product requirement for the onboarding feature.',
      'PRODUCT'
    );
    expect(result).toMatchObject({ status: 'BLOCKED', score: 0 });
    expect(result?.recommendations.length).toBeGreaterThan(0);
  });
});
