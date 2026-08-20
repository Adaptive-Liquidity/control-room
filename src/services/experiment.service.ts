// src/services/experiment.service.ts
import type { Channel, ExperimentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { scopedPrisma } from '@/lib/scope/scoped-prisma';

export class ExperimentServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ExperimentServiceError';
    this.statusCode = statusCode;
  }
}

type Variant = { id: string; name: string; contentId?: string };

export class ExperimentService {
  async getAll(opts: {
    projectId: string;
    status?: ExperimentStatus | string;
    page?: number;
    limit?: number;
  }) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 100);
    const where: { projectId: string; status?: ExperimentStatus } = {
      projectId: opts.projectId,
    };
    if (opts.status) where.status = opts.status as ExperimentStatus;

    const [items, total] = await Promise.all([
      prisma.experiment.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true, email: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.experiment.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: {
    name: string;
    hypothesis: string;
    channel?: Channel;
    variants: Variant[];
    primaryMetric: string;
    guardrailMetrics?: string[];
    createdById: string;
    projectId: string;
  }) {
    if (!data.variants?.length || data.variants.length < 2) {
      throw new ExperimentServiceError('At least two variants are required');
    }

    const experiment = await prisma.experiment.create({
      data: {
        name: data.name,
        hypothesis: data.hypothesis,
        channel: data.channel,
        variants: data.variants as unknown as Prisma.InputJsonValue,
        primaryMetric: data.primaryMetric,
        guardrailMetrics: (data.guardrailMetrics ?? []) as unknown as Prisma.InputJsonValue,
        createdById: data.createdById,
        projectId: data.projectId,
        status: 'PLANNING',
        // Never invent confidence/lift at create time
        liftPct: null,
        confidencePct: null,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    await prisma.activityLog.create({
      data: {
        userId: data.createdById,
        projectId: data.projectId,
        type: 'EXPERIMENT_CREATED',
        description: `Created experiment: "${data.name}"`,
        metadata: { experimentId: experiment.id },
      },
    });

    return experiment;
  }

  async update(
    id: string,
    data: {
      name?: string;
      hypothesis?: string;
      channel?: Channel | null;
      status?: ExperimentStatus;
      variants?: Variant[];
      primaryMetric?: string;
      guardrailMetrics?: string[];
      outcome?: string | null;
      decision?: string | null;
      liftPct?: number | null;
      confidencePct?: number | null;
      startedAt?: string | null;
      endedAt?: string | null;
      userId: string;
    },
    projectId: string
  ) {
    const db = scopedPrisma(projectId, prisma);
    const existing = await db.experiment.findUnique({ where: { id } });
    if (!existing) throw new ExperimentServiceError('Experiment not found', 404);

    // Reject fabricated confidence unless explicitly stored with outcome/decision
    if (data.confidencePct != null && data.outcome == null && existing.outcome == null) {
      throw new ExperimentServiceError(
        'confidencePct may only be set together with a recorded outcome',
        422
      );
    }

    const experiment = await db.experiment.update({
      where: { id },
      data: {
        name: data.name,
        hypothesis: data.hypothesis,
        channel: data.channel === undefined ? undefined : data.channel,
        status: data.status,
        variants: data.variants
          ? (data.variants as unknown as Prisma.InputJsonValue)
          : undefined,
        primaryMetric: data.primaryMetric,
        guardrailMetrics:
          data.guardrailMetrics !== undefined
            ? (data.guardrailMetrics as unknown as Prisma.InputJsonValue)
            : undefined,
        outcome: data.outcome === undefined ? undefined : data.outcome,
        decision: data.decision === undefined ? undefined : data.decision,
        liftPct: data.liftPct === undefined ? undefined : data.liftPct,
        confidencePct: data.confidencePct === undefined ? undefined : data.confidencePct,
        startedAt:
          data.startedAt === undefined
            ? undefined
            : data.startedAt
              ? new Date(data.startedAt)
              : null,
        endedAt:
          data.endedAt === undefined ? undefined : data.endedAt ? new Date(data.endedAt) : null,
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    await db.activityLog.create({
      data: {
        userId: data.userId,
        projectId,
        type: 'EXPERIMENT_UPDATED',
        description: `Updated experiment: "${experiment.name}"`,
        metadata: { experimentId: experiment.id, status: experiment.status },
      },
    });

    return experiment;
  }
}

export const experimentService = new ExperimentService();
