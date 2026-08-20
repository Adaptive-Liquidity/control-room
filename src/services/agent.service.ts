// src/services/agent.service.ts
import type { AgentStatus, AgentType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class AgentService {
  async getAll(projectId: string, opts?: { departmentKey?: string }) {
    const { agentRunService } = await import('@/services/agent-run.service');
    return agentRunService.enrichAgents(projectId, opts);
  }

  async listDepartments() {
    return prisma.agentDepartment.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true },
    });
  }

  async getById(id: string) {
    return prisma.agent.findUnique({ where: { id } });
  }

  async getByName(name: string) {
    return prisma.agent.findUnique({ where: { name } });
  }

  async create(data: {
    name: string;
    type: AgentType;
    config: Prisma.InputJsonValue;
    mcpEndpoint?: string;
  }) {
    return prisma.agent.create({ data });
  }

  async updateStatus(id: string, status: AgentStatus) {
    return prisma.agent.update({
      where: { id },
      data: { status, lastRunAt: status === 'ONLINE' ? new Date() : undefined },
    });
  }

  async updateMetrics(id: string, metrics: { tasksCompleted: number; successRate: number; avgLatency: number }) {
    return prisma.agent.update({
      where: { id },
      data: { metrics },
    });
  }

  async updateMcpStatus(id: string, status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR') {
    return prisma.agent.update({
      where: { id },
      data: { mcpStatus: status },
    });
  }

  async getLogs(agentId: string, projectId: string, limit = 50) {
    // In production, this would query a log aggregation service
    // For now, return from activity logs
    return prisma.activityLog.findMany({
      where: { agentId, projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Agent-specific operations — LLM execution stays in n8n (Agent HQ invariant)

  async runGuardianAgent(contentId: string) {
    // Re-run Guardian check
    const content = await prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new Error('Content not found');

    const { guardianService } = await import('@/lib/guardian/guardian.service');
    return guardianService.checkContent(content.body, content.title, {
      projectId: content.projectId,
    });
  }
}

export const agentService = new AgentService();
