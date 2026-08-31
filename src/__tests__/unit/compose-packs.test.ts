import {
  composeContextPack,
  validateComposition,
  type ContextPack,
} from '@/lib/context/compose-packs';
import { canonicalizeJson } from '@/lib/context/canonicalize-json';

const companyPack: ContextPack = {
  schemaVersion: '1',
  promptCore: {
    identity: { name: 'Adaptive Liquidity', oneLiner: 'Treasury automation' },
    voice: { tone: 'precise' },
    prohibitions: {
      forbiddenClaims: ['guaranteed yield', 'Risk Free'],
      requiredDisclaimers: ['Not financial advice'],
    },
    keyFacts: [{ key: 'stage', value: 'seed' }],
  },
};

const projectPack: ContextPack = {
  schemaVersion: '1',
  promptCore: {
    identity: { name: 'AEON Control Room', oneLiner: 'Agent HQ' },
    voice: { tone: 'precise', audience: 'builders' },
    prohibitions: {
      forbiddenClaims: ['buy aeon', 'guaranteed yield'],
      requiredDisclaimers: [],
    },
    keyFacts: [{ key: 'product', value: 'control-room' }],
  },
};

describe('canonicalizeJson', () => {
  it('is order-independent for object keys', () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe(canonicalizeJson({ a: 2, b: 1 }));
  });
});

describe('composeContextPack', () => {
  it('unions prohibitions and never drops company forbidden claims', () => {
    const result = composeContextPack({
      company: companyPack,
      project: {
        ...projectPack,
        promptCore: {
          ...projectPack.promptCore,
          prohibitions: { forbiddenClaims: ['buy aeon'] },
        },
      },
    });
    const forbidden = result.pack.promptCore.prohibitions?.forbiddenClaims ?? [];
    expect(forbidden.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(['guaranteed yield', 'risk free', 'buy aeon'])
    );
  });

  it('dedupes prohibitions case-insensitively', () => {
    const result = composeContextPack({ company: companyPack, project: projectPack });
    const forbidden = result.pack.promptCore.prohibitions?.forbiddenClaims ?? [];
    const yields = forbidden.filter((s) => s.toLowerCase() === 'guaranteed yield');
    expect(yields).toHaveLength(1);
  });

  it('lets project override voice scalars while inheriting company when silent', () => {
    const result = composeContextPack({ company: companyPack, project: projectPack });
    expect(result.pack.promptCore.voice).toMatchObject({
      tone: 'precise',
      audience: 'builders',
    });
    expect(result.pack.promptCore.identity?.name).toBe('AEON Control Room');
  });

  it('is deterministic for hashes', () => {
    const a = composeContextPack({ company: companyPack, project: projectPack });
    const b = composeContextPack({ company: companyPack, project: projectPack });
    expect(a.composedHash).toBe(b.composedHash);
    expect(a.composedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('pins source version ids', () => {
    const result = composeContextPack({
      company: companyPack,
      project: projectPack,
      companyVersionId: 'ccv1',
      projectVersionId: 'pcv1',
    });
    expect(result.sources).toEqual({
      companyVersionId: 'ccv1',
      projectVersionId: 'pcv1',
    });
  });

  it('merges campaign brief when provided', () => {
    const result = composeContextPack({
      company: companyPack,
      project: projectPack,
      campaign: { objective: 'Launch Q3', thesis: 'Builders need a control plane' },
    });
    expect(result.pack.promptCore.campaignBrief).toEqual({
      objective: 'Launch Q3',
      thesis: 'Builders need a control plane',
    });
  });

  it('rejects project approved claims that company forbids', () => {
    expect(() =>
      validateComposition(companyPack, {
        ...projectPack,
        promptCore: {
          ...projectPack.promptCore,
          approvedClaims: ['guaranteed yield'],
        } as ContextPack['promptCore'],
      })
    ).toThrow(/forbids/);
  });
});
