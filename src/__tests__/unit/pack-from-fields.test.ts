import { mergeCompanyPack, mergeProjectPack } from '@/lib/context/pack-from-fields';
import type { ContextPack } from '@/lib/context/compose-packs';

const base: ContextPack = {
  schemaVersion: '1',
  promptCore: {
    identity: { name: 'Adaptive', oneLiner: 'old line' },
    voice: { tone: 'precise', dont: ['moon'] },
    prohibitions: { forbiddenClaims: ['moon'], requiredDisclaimers: [] },
  },
};

describe('pack-from-fields', () => {
  it('merges company voice and dont-say without dropping identity', () => {
    const next = mergeCompanyPack(base, {
      voiceTone: 'calm',
      dontSay: ['guaranteed yield'],
      oneLiner: 'new line',
    });
    expect(next.promptCore.identity).toMatchObject({ name: 'Adaptive', oneLiner: 'new line' });
    expect(next.promptCore.voice).toMatchObject({ tone: 'calm', dont: ['guaranteed yield'] });
    expect(next.promptCore.prohibitions?.forbiddenClaims).toEqual(['guaranteed yield']);
  });

  it('builds a company pack from empty existing', () => {
    const next = mergeCompanyPack(null, { name: 'HQ', voiceTone: 'precise', dontSay: [] });
    expect(next.schemaVersion).toBe('1');
    expect(next.promptCore.identity).toMatchObject({ name: 'HQ' });
  });

  it('merges project identity fields', () => {
    const next = mergeProjectPack(base, { oneLiner: 'Aeon HQ', description: 'desk' });
    expect(next.promptCore.identity).toMatchObject({
      name: 'Adaptive',
      oneLiner: 'Aeon HQ',
      description: 'desk',
    });
  });
});
