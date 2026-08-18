-- Adds the RESEARCHER agent type used by the MKT-02 research package workflow
-- and by `npm run db:seed-agents`.
-- Apply with: npx prisma migrate deploy

-- AlterEnum AgentType
ALTER TYPE "AgentType" ADD VALUE 'RESEARCHER';
