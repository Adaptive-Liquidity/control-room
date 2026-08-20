export type SetupMembership = {
  projectId: string;
  companyId: string;
  hasPublishedCompanyPack: boolean;
  hasPublishedProjectPack: boolean;
};

export type SetupGateReady = {
  ready: true;
  projectId: string;
};

export type SetupGateBlocked = {
  ready: false;
  missing: Array<'project' | 'company_pack' | 'project_pack'>;
};

export type SetupGateResult = SetupGateReady | SetupGateBlocked;

/**
 * Eligible HQ access: ≥1 membership with published company + project packs.
 */
export function evaluateSetupGate(input: {
  memberships: SetupMembership[];
}): SetupGateResult {
  if (!input.memberships.length) {
    return { ready: false, missing: ['project', 'company_pack', 'project_pack'] };
  }

  const eligible = input.memberships.find(
    (m) => m.hasPublishedCompanyPack && m.hasPublishedProjectPack
  );
  if (eligible) {
    return { ready: true, projectId: eligible.projectId };
  }

  const missing = new Set<'project' | 'company_pack' | 'project_pack'>();
  for (const m of input.memberships) {
    if (!m.hasPublishedCompanyPack) missing.add('company_pack');
    if (!m.hasPublishedProjectPack) missing.add('project_pack');
  }
  if (missing.size === 0) missing.add('project');
  return { ready: false, missing: Array.from(missing) };
}
