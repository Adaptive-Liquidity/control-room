/**
 * Agent-runs ingress emits IDs-only Pusher event after successful upsert.
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    agentRun: { findUnique: jest.fn() },
    n8nBridgeJob: { findUnique: jest.fn() },
    publishReceipt: { findUnique: jest.fn() },
    metricSnapshot: { findUnique: jest.fn() },
    attributionEvent: { findUnique: jest.fn() },
  },
}));

jest.mock('@/services/agent-run.service', () => ({
  agentRunService: {
    ingest: jest.fn(),
  },
}));

jest.mock('@/lib/pusher/server', () => ({
  emitAgentRunUpdated: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '@/lib/prisma';
import { agentRunService } from '@/services/agent-run.service';
import { emitAgentRunUpdated } from '@/lib/pusher/server';
import { POST } from '@/app/api/integrations/n8n/agent-runs/route';
import { makeJsonRequest } from '../helpers/n8n';

const mockedPrisma = prisma as unknown as {
  agentRun: { findUnique: jest.Mock };
  n8nBridgeJob: { findUnique: jest.Mock };
  publishReceipt: { findUnique: jest.Mock };
  metricSnapshot: { findUnique: jest.Mock };
  attributionEvent: { findUnique: jest.Mock };
};

describe('agent-runs pusher wire', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.agentRun.findUnique.mockResolvedValue(null);
    mockedPrisma.n8nBridgeJob.findUnique.mockResolvedValue(null);
    mockedPrisma.publishReceipt.findUnique.mockResolvedValue(null);
    mockedPrisma.metricSnapshot.findUnique.mockResolvedValue(null);
    mockedPrisma.attributionEvent.findUnique.mockResolvedValue(null);
  });

  it('emits emitAgentRunUpdated after non-idempotent ingest', async () => {
    (agentRunService.ingest as jest.Mock).mockResolvedValue({
      run: {
        id: 'run-1',
        agentId: 'agent-1',
        status: 'RUNNING',
        projectId: 'project-1',
      },
      idempotent: false,
    });

    const body = {
      schemaVersion: '1',
      eventId: 'evt-run-1',
      workflowId: 'wf',
      executionId: 'ex',
      status: 'RUNNING',
      agentId: 'agent-1',
      projectId: 'project-1',
    };
    const res = await POST(
      makeJsonRequest('http://localhost/api/integrations/n8n/agent-runs', body)
    );
    expect(res.status).toBe(201);
    expect(emitAgentRunUpdated).toHaveBeenCalledWith({
      agentRunId: 'run-1',
      agentId: 'agent-1',
      status: 'RUNNING',
      projectId: 'project-1',
    });
  });

  it('does not emit on idempotent early return', async () => {
    mockedPrisma.agentRun.findUnique.mockResolvedValue({
      id: 'run-1',
      status: 'SUCCESS',
    });

    const body = {
      schemaVersion: '1',
      eventId: 'evt-run-1',
      workflowId: 'wf',
      executionId: 'ex',
      status: 'SUCCESS',
    };
    const res = await POST(
      makeJsonRequest('http://localhost/api/integrations/n8n/agent-runs', body)
    );
    expect(res.status).toBe(200);
    expect(agentRunService.ingest).not.toHaveBeenCalled();
    expect(emitAgentRunUpdated).not.toHaveBeenCalled();
  });
});
