import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ForbiddenError, requirePermission } from '@/lib/rbac';
import { agentService } from '@/services/agent.service';
import {
  ForbiddenProjectError,
  SetupRequiredError,
  resolveProjectContext,
} from '@/lib/project/context';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['CREATOR', 'PUBLISHER', 'ANALYZER', 'GUARDIAN', 'RESEARCHER']),
  config: z.record(z.unknown()).optional(),
  mcpEndpoint: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });
    const departmentKey = new URL(req.url).searchParams.get('department') || undefined;
    const [agents, departments] = await Promise.all([
      agentService.getAll(ctx.projectId, { departmentKey }),
      agentService.listDepartments(),
    ]);
    return NextResponse.json({ agents, departments, department: departmentKey ?? null });
  } catch (error) {
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    requirePermission(session, 'settings.manage');
    await resolveProjectContext({
      requestedProjectId: req.headers.get('x-project-id'),
    });

    const validated = createSchema.parse(await req.json());

    const existing = await agentService.getByName(validated.name);
    if (existing) {
      return NextResponse.json(
        { error: `Agent "${validated.name}" already exists` },
        { status: 409 }
      );
    }

    const agent = await agentService.create({
      name: validated.name,
      type: validated.type,
      config: (validated.config ?? {}) as Prisma.InputJsonValue,
      mcpEndpoint: validated.mcpEndpoint,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof SetupRequiredError || error instanceof ForbiddenProjectError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('POST /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
