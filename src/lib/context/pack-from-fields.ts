import type { ContextPack } from './compose-packs';

export type CompanyPackFields = {
  name?: string;
  legalName?: string;
  oneLiner?: string;
  voiceTone?: string;
  dontSay?: string[];
};

export type ProjectPackFields = {
  name?: string;
  oneLiner?: string;
  description?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export function mergeCompanyPack(existing: ContextPack | null, fields: CompanyPackFields): ContextPack {
  const core = existing?.promptCore ?? {};
  const identity = asRecord(core.identity);
  const voice = asRecord(core.voice);
  const prohibitions = asRecord(core.prohibitions);
  const dontSay = fields.dontSay ?? asStringList(voice.dont);

  return {
    schemaVersion: existing?.schemaVersion ?? '1',
    promptCore: {
      ...core,
      identity: {
        ...identity,
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.legalName !== undefined ? { legalName: fields.legalName } : {}),
        ...(fields.oneLiner !== undefined ? { oneLiner: fields.oneLiner } : {}),
      },
      voice: {
        ...voice,
        ...(fields.voiceTone !== undefined ? { tone: fields.voiceTone } : {}),
        dont: dontSay,
      },
      prohibitions: {
        ...prohibitions,
        forbiddenClaims: fields.dontSay ?? asStringList(prohibitions.forbiddenClaims),
        requiredDisclaimers: asStringList(prohibitions.requiredDisclaimers),
      },
    },
    ...(existing?.reference ? { reference: existing.reference } : {}),
  };
}

export function mergeProjectPack(existing: ContextPack | null, fields: ProjectPackFields): ContextPack {
  const core = existing?.promptCore ?? {};
  const identity = asRecord(core.identity);

  return {
    schemaVersion: existing?.schemaVersion ?? '1',
    promptCore: {
      ...core,
      identity: {
        ...identity,
        ...(fields.name !== undefined ? { name: fields.name } : {}),
        ...(fields.oneLiner !== undefined ? { oneLiner: fields.oneLiner } : {}),
        ...(fields.description !== undefined ? { description: fields.description } : {}),
      },
    },
    ...(existing?.reference ? { reference: existing.reference } : {}),
  };
}
