/**
 * Idempotent AEON agent roster seed — safe for local, staging, and production.
 *
 * Canonical names (must match n8n AgentRun `agentName`):
 *   creator | publisher | analyzer | guardian | researcher
 *
 * Usage:
 *   npm run db:seed-agents
 *   # or: npx tsx scripts/seed-agents.ts
 *
 * Requires DATABASE_URL (loaded from `.env` via `./load-env`).
 */
import './load-env';
import { AgentType, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedAgent = {
  name: string;
  type: AgentType;
  config: Prisma.InputJsonObject;
};

const AGENTS: SeedAgent[] = [
  {
    name: 'creator',
    type: 'CREATOR',
    config: {
      role: 'draft_generation',
      promptVersionDefault: 'mkt-03-v1',
      channels: ['TWITTER', 'LINKEDIN', 'DISCORD', 'EMAIL', 'BLOG'],
    },
  },
  {
    name: 'publisher',
    type: 'PUBLISHER',
    config: {
      role: 'channel_publish',
      promptVersionDefault: 'mkt-05-v1',
      mockUntilCreds: true,
    },
  },
  {
    name: 'analyzer',
    type: 'ANALYZER',
    config: {
      role: 'performance_analysis',
      promptVersionDefault: 'mkt-06-v1',
    },
  },
  {
    name: 'guardian',
    type: 'GUARDIAN',
    config: {
      role: 'policy_evaluation',
      note: 'Primary Guardian evaluation runs in Control Room; this row is for telemetry parity',
    },
  },
  {
    name: 'researcher',
    type: 'RESEARCHER',
    config: {
      role: 'research_package',
      promptVersionDefault: 'mkt-02-v1',
    },
  },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const agent of AGENTS) {
    const existing = await prisma.agent.findUnique({ where: { name: agent.name } });
    let agentId: string;

    if (!existing) {
      const row = await prisma.agent.create({
        data: {
          name: agent.name,
          type: agent.type,
          config: agent.config,
          status: 'OFFLINE',
        },
      });
      agentId = row.id;
      created += 1;
      console.log(`created ${agent.name} (${agent.type})`);
    } else {
      const row = await prisma.agent.update({
        where: { name: agent.name },
        data: {
          type: agent.type,
          config: agent.config,
        },
      });
      agentId = row.id;
      updated += 1;
      console.log(`updated ${agent.name} (${agent.type})`);
    }

    const backfilled = await prisma.agentRun.updateMany({
      where: { agentName: agent.name, agentId: null },
      data: { agentId },
    });
    if (backfilled.count > 0) {
      console.log(`backfilled ${backfilled.count} agent run(s) for ${agent.name}`);
    }
  }

  console.log(JSON.stringify({ created, updated, total: AGENTS.length }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
