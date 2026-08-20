export type ProjectMembership = {
  projectId: string;
  companyId: string;
  role: string;
};

export type ProjectScopeOk = {
  ok: true;
  projectId: string;
  companyId: string;
  role: string;
};

export type ProjectScopeErr = {
  ok: false;
  reason: 'unauthenticated' | 'no_membership' | 'no_project';
};

export type ProjectScopeResult = ProjectScopeOk | ProjectScopeErr;

/**
 * Resolve active project from memberships. Company is always derived — never trusted from client.
 */
export function resolveProjectScope(input: {
  userId: string | null | undefined;
  requestedProjectId?: string | null;
  memberships: ProjectMembership[];
  /** Ignored — present so callers cannot accidentally trust it */
  clientCompanyId?: string | null;
}): ProjectScopeResult {
  void input.clientCompanyId;

  if (!input.userId) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const memberships = input.memberships ?? [];
  if (memberships.length === 0) {
    return { ok: false, reason: 'no_membership' };
  }

  const requested = input.requestedProjectId?.trim() || undefined;

  if (requested) {
    const match = memberships.find((m) => m.projectId === requested);
    if (!match) {
      return { ok: false, reason: 'no_membership' };
    }
    return {
      ok: true,
      projectId: match.projectId,
      companyId: match.companyId,
      role: match.role,
    };
  }

  if (memberships.length === 1) {
    const only = memberships[0];
    return {
      ok: true,
      projectId: only.projectId,
      companyId: only.companyId,
      role: only.role,
    };
  }

  return { ok: false, reason: 'no_project' };
}
