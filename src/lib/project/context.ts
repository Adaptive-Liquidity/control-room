import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveProjectScope } from '@/lib/scope/project-scope';
import { evaluateSetupGate } from '@/lib/setup/setup-gate';
import type { Permission } from '@/lib/rbac';
import { hasPermission } from '@/lib/rbac';

export const ACTIVE_PROJECT_COOKIE = 'cr_active_project';

export type ProjectContext = {
  projectId: string;
  slug: string;
  name: string;
  role: string;
  company: { id: string; slug: string; name: string };
  projects: Array<{
    id: string;
    slug: string;
    name: string;
    companyId: string;
    companyName: string;
    companySlug: string;
  }>;
};

export class ForbiddenProjectError extends Error {
  status = 403;
  constructor(message = 'Forbidden project') {
    super(message);
    this.name = 'ForbiddenProjectError';
  }
}

export class SetupRequiredError extends Error {
  status = 403;
  constructor(message = 'HQ setup required') {
    super(message);
    this.name = 'SetupRequiredError';
  }
}

async function loadMemberships(userId: string) {
  const rows = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        include: {
          company: { include: { activeContextVersion: true } },
          activeContextVersion: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    projectId: row.projectId,
    companyId: row.project.companyId,
    role: row.role,
    slug: row.project.slug,
    name: row.project.name,
    companySlug: row.project.company.slug,
    companyName: row.project.company.name,
    hasPublishedCompanyPack: Boolean(row.project.company.activeContextVersionId),
    hasPublishedProjectPack: Boolean(row.project.activeContextVersionId),
  }));
}

/**
 * Authoritative project resolution for server components / API routes.
 */
export async function resolveProjectContext(opts?: {
  requestedProjectId?: string | null;
  requireReady?: boolean;
}): Promise<ProjectContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new ForbiddenProjectError('Unauthenticated');
  }

  const memberships = await loadMemberships(session.user.id);
  const gate = evaluateSetupGate({ memberships });
  if (opts?.requireReady !== false && !gate.ready) {
    throw new SetupRequiredError();
  }

  const cookieStore = cookies();
  const cookieProject = cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value;
  const preferred =
    opts?.requestedProjectId ||
    cookieProject ||
    session.user.lastActiveProjectId ||
    undefined;

  const scope = resolveProjectScope({
    userId: session.user.id,
    requestedProjectId: preferred,
    memberships: memberships.map((m) => ({
      projectId: m.projectId,
      companyId: m.companyId,
      role: m.role,
    })),
  });

  if (!scope.ok) {
    if (opts?.requestedProjectId) {
      throw new ForbiddenProjectError(scope.reason);
    }
    if (gate.ready && 'projectId' in gate) {
      const fallback = memberships.find((m) => m.projectId === gate.projectId)!;
      return {
        projectId: fallback.projectId,
        slug: fallback.slug,
        name: fallback.name,
        role: fallback.role,
        company: {
          id: fallback.companyId,
          slug: fallback.companySlug,
          name: fallback.companyName,
        },
        projects: memberships.map((m) => ({
          id: m.projectId,
          slug: m.slug,
          name: m.name,
          companyId: m.companyId,
          companyName: m.companyName,
          companySlug: m.companySlug,
        })),
      };
    }
    throw new ForbiddenProjectError(scope.reason);
  }

  const match = memberships.find((m) => m.projectId === scope.projectId)!;
  return {
    projectId: scope.projectId,
    slug: match.slug,
    name: match.name,
    role: scope.role,
    company: {
      id: scope.companyId,
      slug: match.companySlug,
      name: match.companyName,
    },
    projects: memberships.map((m) => ({
      id: m.projectId,
      slug: m.slug,
      name: m.name,
      companyId: m.companyId,
      companyName: m.companyName,
      companySlug: m.companySlug,
    })),
  };
}

export function requireProjectPermission(
  ctx: ProjectContext,
  permission: Permission
): void {
  if (!hasPermission(ctx.role, permission)) {
    throw new ForbiddenProjectError(`Missing permission: ${permission}`);
  }
}
