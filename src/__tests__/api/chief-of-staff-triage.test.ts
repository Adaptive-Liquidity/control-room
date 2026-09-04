jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/project/context', () => {
  const actual = jest.requireActual('@/lib/project/context');
  return {
    ...actual,
    resolveProjectContext: jest.fn(),
  };
});

import { getServerSession } from 'next-auth';
import { resolveProjectContext } from '@/lib/project/context';
import { POST } from '@/app/api/chief-of-staff/triage/route';
import { session } from '../helpers/n8n';
import { NextRequest } from 'next/server';

function projectCtx(role: string) {
  return {
    projectId: 'proj_aeon',
    slug: 'aeon',
    name: 'AEON',
    role,
    company: { id: 'cmpy_1', slug: 'adaptive', name: 'Adaptive' },
    projects: [],
  };
}

function post(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/chief-of-staff/triage', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })
  );
}

describe('POST /api/chief-of-staff/triage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('ADMIN'));
  });

  it('returns 401 when unauthenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await post({ request: 'Research the competitor market.' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for SERVICE accounts', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('SERVICE', 'svc-1'));
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('SERVICE'));
    const res = await post({ request: 'Research the competitor market.' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for malformed intake', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'adm-1'));
    const res = await post({ request: 'ok', urgency: 9 });
    expect(res.status).toBe(400);
  });

  it('triages with the active project, ignoring client projectId', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'adm-1'));
    const res = await post({
      request: 'Research the competitor market and compare their positioning.',
      projectId: 'client-must-not-win',
      urgency: 5,
      impact: 5,
      effort: 1,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.projectId).toBe('proj_aeon');
    expect(data.triage).toMatchObject({
      department: 'RESEARCH',
      priority: 'NOW',
      approvalRequired: false,
    });
    expect(data.intake.request).toContain('competitor');
    expect(data.productReadiness).toBeNull();
    expect(data.researchReadiness).toMatchObject({
      status: 'BLOCKED',
      score: 0,
    });
    expect(data.researchReadiness.missingFields).toContain('question');
  });

  it('attaches a blocked product brief gate for PRODUCT work', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('ADMIN', 'adm-1'));
    const res = await post({
      request: 'Write a product requirement for the onboarding feature.',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.triage.department).toBe('PRODUCT');
    expect(data.productReadiness).toMatchObject({
      status: 'BLOCKED',
      score: 0,
    });
    expect(data.productReadiness.missingFields).toEqual(
      expect.arrayContaining(['problem', 'targetUser', 'desiredOutcome'])
    );
    expect(data.researchReadiness).toBeNull();
  });

  it('flags high-risk customer contact as approval required', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(session('EDITOR', 'ed-1'));
    (resolveProjectContext as jest.Mock).mockResolvedValue(projectCtx('EDITOR'));
    const res = await post({
      request: 'Send email outreach to a new sales prospect.',
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.triage.approvalRequired).toBe(true);
    expect(data.triage.riskTier).toBe('HIGH');
    expect(data.productReadiness).toBeNull();
    expect(data.researchReadiness).toBeNull();
  });
});
