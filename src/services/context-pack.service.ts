import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { canonicalizeJson } from '@/lib/context/canonicalize-json';
import {
  hashContextPack,
  validateComposition,
  type ContextPack,
} from '@/lib/context/compose-packs';

export class ContextPackService {
  canonicalizeAndHash(pack: unknown): string {
    return hashContextPack(pack);
  }

  async getPublishedCompanyPack(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { activeContextVersion: true },
    });
    return company?.activeContextVersion ?? null;
  }

  async getPublishedProjectPack(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        activeContextVersion: true,
        company: { include: { activeContextVersion: true } },
      },
    });
    return project;
  }

  async publishCompanyPack(input: {
    companyId: string;
    pack: ContextPack;
    createdById?: string;
    summary?: string;
  }) {
    const contentHash = this.canonicalizeAndHash(input.pack);
    return prisma.$transaction(async (tx) => {
      const latest = await tx.companyContextVersion.findFirst({
        where: { companyId: input.companyId },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      const row = await tx.companyContextVersion.create({
        data: {
          companyId: input.companyId,
          version,
          status: 'PUBLISHED',
          pack: input.pack as object,
          contentHash,
          summary: input.summary,
          createdById: input.createdById,
          publishedAt: new Date(),
        },
      });
      await tx.company.update({
        where: { id: input.companyId },
        data: { activeContextVersionId: row.id, setupCompletedAt: new Date() },
      });
      return row;
    });
  }

  async publishProjectPack(input: {
    projectId: string;
    pack: ContextPack;
    createdById?: string;
    summary?: string;
  }) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: { company: { include: { activeContextVersion: true } } },
    });
    if (!project?.company.activeContextVersion) {
      throw new Error('Company must have a published context pack first');
    }
    const companyPack = project.company.activeContextVersion.pack as ContextPack;
    validateComposition(companyPack, input.pack);

    const contentHash = this.canonicalizeAndHash(input.pack);
    return prisma.$transaction(async (tx) => {
      const latest = await tx.projectContextVersion.findFirst({
        where: { projectId: input.projectId },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      const row = await tx.projectContextVersion.create({
        data: {
          projectId: input.projectId,
          version,
          status: 'PUBLISHED',
          pack: input.pack as object,
          contentHash,
          summary: input.summary,
          createdById: input.createdById,
          publishedAt: new Date(),
        },
      });
      await tx.project.update({
        where: { id: input.projectId },
        data: { activeContextVersionId: row.id },
      });
      return row;
    });
  }
}

export const contextPackService = new ContextPackService();

/** sha256 of raw string — used by tests / callers that already canonicalized */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashCanonical(value: unknown): string {
  return `sha256:${sha256Hex(canonicalizeJson(value))}`;
}
