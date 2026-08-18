// src/services/agent-run.service.ts
import type { AgentRunStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const RUN_SUMMARY_SELECT = {
  status: true,
  latencyMs: true,
  tokensIn: true,
  tokensOut: true,
  costUsd: true,
  errorMessage: true,
  createdAt: true,
} as const;

type RunSummaryInput = {
  status: AgentRunStatus;
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  errorMessage: string | null;
  createdAt: Date;
};

export class AgentRunService {
  async ingest(payload: {
    eventId: string;
    workflowId: string;
    executionId: string;
    status: AgentRunStatus;
    agentId?: string;
    agentName?: string;
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    modelAlias?: string;
    promptVersion?: string;
    errorCode?: string;
    errorMessage?: string;
    startedAt?: string;
    finishedAt?: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = await prisma.agentRun.findUnique({ where: { eventId: payload.eventId } });
    if (existing) {
      return { run: existing, idempotent: true };
    }

    let agentId = payload.agentId ?? null;
    if (!agentId && payload.agentName) {
      const byName = await prisma.agent.findUnique({
        where: { name: payload.agentName },
        select: { id: true },
      });
      agentId = byName?.id ?? null;
    }

    const run = await prisma.$transaction(async (tx) => {
      const created = await tx.agentRun.create({
        data: {
          eventId: payload.eventId,
          agentId,
          agentName: payload.agentName,
          workflowId: payload.workflowId,
          executionId: payload.executionId,
          status: payload.status,
          latencyMs: payload.latencyMs,
          tokensIn: payload.tokensIn,
          tokensOut: payload.tokensOut,
          costUsd: payload.costUsd,
          modelAlias: payload.modelAlias,
          promptVersion: payload.promptVersion,
          errorCode: payload.errorCode,
          errorMessage: payload.errorMessage,
          startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
          finishedAt: payload.finishedAt ? new Date(payload.finishedAt) : undefined,
          metadata: (payload.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });

      if (agentId) {
        const agentStatus =
          payload.status === 'RUNNING' || payload.status === 'WAITING_APPROVAL'
            ? 'BUSY'
            : payload.status === 'FAILED'
              ? 'ERROR'
              : payload.status === 'SUCCESS'
                ? 'ONLINE'
                : undefined;

        await tx.agent.update({
          where: { id: agentId },
          data: {
            lastRunAt: new Date(),
            ...(agentStatus ? { status: agentStatus } : {}),
          },
        });
      }

      await tx.activityLog.create({
        data: {
          agentId: agentId ?? undefined,
          type: 'AGENT_RUN_UPDATED',
          description: `Agent run ${payload.status}: ${payload.workflowId}/${payload.executionId}`,
          metadata: {
            eventId: payload.eventId,
            runId: created.id,
            status: payload.status,
            modelAlias: payload.modelAlias,
            promptVersion: payload.promptVersion,
          },
        },
      });

      return created;
    });

    return { run, idempotent: false };
  }

  private summarizeRuns(runs: RunSummaryInput[]) {
    const success = runs.filter((r) => r.status === 'SUCCESS').length;
    const failed = runs.filter((r) => r.status === 'FAILED').length;
    const latencies = runs
      .map((r) => r.latencyMs)
      .filter((n): n is number => typeof n === 'number');
    const avgLatency =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;
    const totalCost = runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
    const totalTokens = runs.reduce((sum, r) => sum + (r.tokensIn ?? 0) + (r.tokensOut ?? 0), 0);

    return {
      aggregates24h: {
        runs: runs.length,
        success,
        failed,
        successRate: runs.length ? Math.round((success / runs.length) * 1000) / 10 : null,
        avgLatencyMs: avgLatency,
        totalTokens,
        totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
      },
      recentRuns: runs.slice(0, 5).map((r) => ({
        status: r.status,
        latencyMs: r.latencyMs,
        createdAt: r.createdAt,
        errorMessage: r.errorMessage,
      })),
    };
  }

  async enrichAgents() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const agents = await prisma.agent.findMany({ orderBy: { updatedAt: 'desc' } });

    const enriched = await Promise.all(
      agents.map(async (agent) => {
        const [lastRun, runs24h] = await Promise.all([
          prisma.agentRun.findFirst({
            where: { agentId: agent.id },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.agentRun.findMany({
            where: { agentId: agent.id, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            select: RUN_SUMMARY_SELECT,
          }),
        ]);

        return {
          ...agent,
          unregistered: false,
          lastRun,
          runs24h: runs24h.length,
          ...this.summarizeRuns(runs24h),
        };
      })
    );

    const unregistered = await this.unregisteredAgentCards(
      agents.map((a) => a.name),
      since
    );

    return [...enriched, ...unregistered];
  }

  /**
   * n8n can emit runs for an `agentName` that was never registered in Control Room.
   * Those runs would otherwise be invisible on the agents surface, so they are
   * surfaced as synthetic read-only cards alongside registered agents.
   */
  private async unregisteredAgentCards(registeredNames: string[], since: Date) {
    const registered = new Set(registeredNames);

    const nameRows = await prisma.agentRun.findMany({
      where: { createdAt: { gte: since }, agentName: { not: null } },
      distinct: ['agentName'],
      select: { agentName: true },
      orderBy: { agentName: 'asc' },
    });

    const orphanNames = nameRows
      .map((row) => row.agentName)
      .filter((name): name is string => name !== null && !registered.has(name));

    return Promise.all(
      orphanNames.map(async (name) => {
        const [lastRun, runs24h] = await Promise.all([
          prisma.agentRun.findFirst({
            where: { agentName: name },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.agentRun.findMany({
            where: { agentName: name, createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            select: RUN_SUMMARY_SELECT,
          }),
        ]);

        return {
          id: null,
          name,
          type: 'UNREGISTERED' as const,
          status: 'OFFLINE' as const,
          unregistered: true,
          config: {},
          metrics: null,
          mcpEndpoint: null,
          mcpStatus: 'DISCONNECTED' as const,
          lastRunAt: lastRun?.createdAt ?? null,
          lastRun,
          runs24h: runs24h.length,
          ...this.summarizeRuns(runs24h),
        };
      })
    );
  }
}

export const agentRunService = new AgentRunService();
