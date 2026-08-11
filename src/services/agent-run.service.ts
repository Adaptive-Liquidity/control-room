// src/services/agent-run.service.ts
import type { AgentRunStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

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
            select: {
              status: true,
              latencyMs: true,
              tokensIn: true,
              tokensOut: true,
              costUsd: true,
              errorMessage: true,
              createdAt: true,
            },
          }),
        ]);

        const success = runs24h.filter((r) => r.status === 'SUCCESS').length;
        const failed = runs24h.filter((r) => r.status === 'FAILED').length;
        const latencies = runs24h
          .map((r) => r.latencyMs)
          .filter((n): n is number => typeof n === 'number');
        const avgLatency =
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null;
        const totalCost = runs24h.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
        const totalTokens = runs24h.reduce(
          (sum, r) => sum + (r.tokensIn ?? 0) + (r.tokensOut ?? 0),
          0
        );

        return {
          ...agent,
          lastRun,
          aggregates24h: {
            runs: runs24h.length,
            success,
            failed,
            successRate: runs24h.length ? Math.round((success / runs24h.length) * 1000) / 10 : null,
            avgLatencyMs: avgLatency,
            totalTokens,
            totalCostUsd: Math.round(totalCost * 1e6) / 1e6,
          },
          recentRuns: runs24h.slice(0, 5).map((r) => ({
            status: r.status,
            latencyMs: r.latencyMs,
            createdAt: r.createdAt,
            errorMessage: r.errorMessage,
          })),
        };
      })
    );

    return enriched;
  }
}

export const agentRunService = new AgentRunService();
