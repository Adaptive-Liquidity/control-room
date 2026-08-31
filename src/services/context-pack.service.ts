import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canonicalizeJson } from '@/lib/context/canonicalize-json';
import {
  hashContextPack,
  validateComposition,
  type ContextPack,
} from '@/lib/context/compose-packs';

type DbClient = Prisma.TransactionClient;

export class CompanyPackRequiredError extends Error {
  constructor() {
    super('Company must have a published context pack first');
    this.name = 'CompanyPackRequiredError';
  }
}

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

  async publishCompanyPack(
    input: {
      companyId: string;
      pack: ContextPack;
      createdById?: string;
      summary?: string;
    },
    tx?: DbClient
  ) {
    const run = async (db: DbClient) => {
      const contentHash = this.canonicalizeAndHash(input.pack);
      const latest = await db.companyContextVersion.findFirst({
        where: { companyId: input.companyId },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      const row = await db.companyContextVersion.create({
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
      await db.company.update({
        where: { id: input.companyId },
        data: {
          activeContextVersionId: row.id,
          ...(latest ? {} : { setupCompletedAt: new Date() }),
        },
      });
      return row;
    };
    return tx ? run(tx) : prisma.$transaction(run);
  }

  async publishProjectPack(
    input: {
      projectId: string;
      pack: ContextPack;
      createdById?: string;
      summary?: string;
    },
    tx?: DbClient
  ) {
    const run = async (db: DbClient) => {
      const project = await db.project.findUnique({
        where: { id: input.projectId },
        include: { company: { include: { activeContextVersion: true } } },
      });
      if (!project?.company.activeContextVersion) {
        throw new CompanyPackRequiredError();
      }
      const companyPack = project.company.activeContextVersion.pack as ContextPack;
      validateComposition(companyPack, input.pack);

      const contentHash = this.canonicalizeAndHash(input.pack);
      const latest = await db.projectContextVersion.findFirst({
        where: { projectId: input.projectId },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      const row = await db.projectContextVersion.create({
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
      await db.project.update({
        where: { id: input.projectId },
        data: { activeContextVersionId: row.id },
      });
      return row;
    };
    return tx ? run(tx) : prisma.$transaction(run);
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
