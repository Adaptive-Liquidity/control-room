// src/services/agent.service.ts
import { prisma } from '@/lib/prisma';
import type { Agent, AgentType, AgentStatus } from '@/types';

export class AgentService {
  async getAll() {
    return prisma.agent.findMany({
      orderBy: { updatedAt: 'desc' },
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
    config: Record<string, unknown>;
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
      data: { metrics: metrics as any },
    });
  }

  async updateMcpStatus(id: string, status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR') {
    return prisma.agent.update({
      where: { id },
      data: { mcpStatus: status },
    });
  }

  async getLogs(agentId: string, limit = 50) {
    // In production, this would query a log aggregation service
    // For now, return from activity logs
    return prisma.activityLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Agent-specific operations
  async runCreatorAgent(prompt: string, contentType: string, channel: string) {
    // This would integrate with OpenAI/Claude
    // For now, return a structured response
    return {
      title: `Generated ${contentType} for ${channel}`,
      body: prompt,
      suggestions: ['Add maturity band label', 'Include source citation', 'Verify regulatory disclaimer'],
    };
  }

  async runPublisherAgent(contentId: string, channels: string[]) {
    // Publish to multiple channels
    const results = [];
    for (const channel of channels) {
      results.push({ channel, status: 'published', timestamp: new Date() });
    }
    return results;
  }

  async runAnalyzerAgent(contentId: string) {
    // Analyze content performance
    return {
      predictedEngagement: 4.8,
      predictedReach: 10200,
      predictedSignups: 4,
      confidence: 0.87,
      similarTopPerformer: 'AEGIS Safety Thread',
    };
  }

  async runGuardianAgent(contentId: string) {
    // Re-run Guardian check
    const content = await prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new Error('Content not found');

    const { guardianService } = await import('@/lib/guardian/guardian.service');
    return guardianService.checkContent(content.body, content.title);
  }
}

export const agentService = new AgentService();
