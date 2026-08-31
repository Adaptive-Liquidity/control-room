import {
  resolveRequireHuman,
} from '@/lib/n8n/campaign-policy';

describe('resolveRequireHuman (campaign risk knobs)', () => {
  it('defaults to requiring human review', () => {
    expect(resolveRequireHuman(null)).toBe(true);
    expect(resolveRequireHuman({})).toBe(true);
  });

  it('honors explicit requireHuman=true', () => {
    expect(resolveRequireHuman({ requireHuman: true }, 'LOW')).toBe(true);
  });

  it('allows autoApproveBelow when risk is at or under the threshold', () => {
    expect(
      resolveRequireHuman({ autoApproveBelow: 'MEDIUM' }, 'LOW')
    ).toBe(false);
    expect(
      resolveRequireHuman({ autoApproveBelow: 'MEDIUM' }, 'MEDIUM')
    ).toBe(false);
    expect(
      resolveRequireHuman({ autoApproveBelow: 'MEDIUM' }, 'HIGH')
    ).toBe(true);
  });

  it('forces human review when risk exceeds riskCeiling', () => {
    expect(
      resolveRequireHuman(
        { requireHuman: false, riskCeiling: 'MEDIUM' },
        'HIGH'
      )
    ).toBe(true);
  });

  it('evaluates riskCeiling before autoApproveBelow', () => {
    expect(
      resolveRequireHuman(
        { autoApproveBelow: 'CRITICAL', riskCeiling: 'LOW' },
        'MEDIUM'
      )
    ).toBe(true);
  });

  it('fails closed on unrecognized tier strings', () => {
    expect(
      resolveRequireHuman(
        { requireHuman: false, autoApproveBelow: 'critical' as any },
        'LOW'
      )
    ).toBe(true);
  });

  it('keeps requireHuman=false only when risk stays within knobs', () => {
    expect(
      resolveRequireHuman(
        { requireHuman: false, riskCeiling: 'HIGH', autoApproveBelow: 'LOW' },
        'LOW'
      )
    ).toBe(false);
  });
});
