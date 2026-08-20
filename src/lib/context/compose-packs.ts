import { createHash } from 'crypto';
import { canonicalizeJson } from './canonicalize-json';

export type ContextPack = {
  schemaVersion: string;
  promptCore: {
    identity?: Record<string, unknown>;
    voice?: Record<string, unknown>;
    prohibitions?: {
      forbiddenClaims?: string[];
      requiredDisclaimers?: string[];
    };
    keyFacts?: unknown[];
    campaignBrief?: { objective?: string; thesis?: string };
    [key: string]: unknown;
  };
  reference?: Record<string, unknown>;
};

export type ComposeInput = {
  company: ContextPack;
  project: ContextPack;
  companyVersionId?: string;
  projectVersionId?: string;
  campaign?: { objective?: string | null; thesis?: string | null };
  includeReference?: boolean;
};

export type ComposeResult = {
  pack: ContextPack;
  composedHash: string;
  companyContextHash: string;
  projectContextHash: string;
  sources: {
    companyVersionId?: string;
    projectVersionId?: string;
  };
};

function hashPack(pack: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalizeJson(pack)).digest('hex')}`;
}

function normList(items: string[] | undefined): string[] {
  if (!items?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function unionLists(...lists: (string[] | undefined)[]): string[] {
  return normList(lists.flatMap((l) => l ?? []));
}

function mergeScalars(
  company: Record<string, unknown> | undefined,
  project: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(company ?? {}), ...(project ?? {}) };
}

/**
 * Reject packs that try to approve a company-forbidden claim.
 */
export function validateComposition(company: ContextPack, project: ContextPack): void {
  const forbidden = new Set(
    normList(company.promptCore?.prohibitions?.forbiddenClaims).map((s) =>
      s.toLowerCase()
    )
  );
  const projectApproved = normList(
    (project.promptCore as { approvedClaims?: string[] } | undefined)?.approvedClaims
  );
  for (const claim of projectApproved) {
    if (forbidden.has(claim.toLowerCase())) {
      throw new Error(
        `Project approves claim "${claim}" which company forbids`
      );
    }
  }
}

/**
 * Compose company + project (+ optional campaign) into one prompt pack.
 * Prohibitions are union-only — project cannot weaken company rules.
 */
export function composeContextPack(input: ComposeInput): ComposeResult {
  validateComposition(input.company, input.project);

  const companyCore = input.company.promptCore ?? { identity: {} };
  const projectCore = input.project.promptCore ?? { identity: {} };

  const forbiddenClaims = unionLists(
    companyCore.prohibitions?.forbiddenClaims,
    projectCore.prohibitions?.forbiddenClaims
  );
  const requiredDisclaimers = unionLists(
    companyCore.prohibitions?.requiredDisclaimers,
    projectCore.prohibitions?.requiredDisclaimers
  );

  const promptCore: ContextPack['promptCore'] = {
    identity: mergeScalars(
      companyCore.identity as Record<string, unknown> | undefined,
      projectCore.identity as Record<string, unknown> | undefined
    ),
    voice: mergeScalars(
      companyCore.voice as Record<string, unknown> | undefined,
      projectCore.voice as Record<string, unknown> | undefined
    ),
    prohibitions: {
      forbiddenClaims,
      requiredDisclaimers,
    },
    keyFacts: [
      ...((companyCore.keyFacts as unknown[]) ?? []),
      ...((projectCore.keyFacts as unknown[]) ?? []),
    ],
  };

  if (input.campaign) {
    const objective = (input.campaign.objective ?? '').slice(0, 500) || undefined;
    const thesis = (input.campaign.thesis ?? '').slice(0, 2000) || undefined;
    if (objective || thesis) {
      promptCore.campaignBrief = { objective, thesis };
    }
  }

  const pack: ContextPack = {
    schemaVersion: input.project.schemaVersion || input.company.schemaVersion || '1',
    promptCore,
  };

  if (input.includeReference) {
    pack.reference = {
      ...(input.company.reference ?? {}),
      ...(input.project.reference ?? {}),
    };
  }

  return {
    pack,
    composedHash: hashPack(pack),
    companyContextHash: hashPack(input.company),
    projectContextHash: hashPack(input.project),
    sources: {
      companyVersionId: input.companyVersionId,
      projectVersionId: input.projectVersionId,
    },
  };
}

export function hashContextPack(pack: unknown): string {
  return hashPack(pack);
}
