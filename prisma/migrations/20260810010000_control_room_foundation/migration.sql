-- Control Room foundation schema.
-- Generated for review; DO NOT auto-apply in this PR.
-- Apply with: npx prisma migrate deploy
-- NOTE: approvals.revisionId is NOT NULL. Apply only when approvals is empty,
-- or backfill revision rows before adding the FK.
-- After apply: npx tsx scripts/seed-guardian-rules.ts
--
-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('MANUAL', 'N8N');

-- CreateEnum
CREATE TYPE "ContentRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "GuardianResult" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('PENDING', 'DELIVERED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'RETRY', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "ContentStatus" ADD VALUE 'REVISION_REQUESTED';

-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'N8N';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'REVIEWER';
ALTER TYPE "UserRole" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "approvals" ADD COLUMN     "revisionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "currentRevisionId" TEXT,
ADD COLUMN     "externalDraftId" TEXT,
ADD COLUMN     "n8nExecutionId" TEXT,
ADD COLUMN     "n8nWorkflowId" TEXT,
ADD COLUMN     "origin" "ContentOrigin" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "riskTier" "ContentRiskTier" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "guardian_rules" ADD COLUMN     "action" "RuleAction" NOT NULL DEFAULT 'REVIEW';

-- CreateTable
CREATE TABLE "content_revisions" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "type" "ContentType" NOT NULL,
    "contentHash" TEXT NOT NULL,
    "guardianPolicyVersion" TEXT NOT NULL,
    "guardianScore" INTEGER NOT NULL,
    "guardianResult" "GuardianResult" NOT NULL,
    "guardianChecks" JSONB,
    "guardianFlags" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n8n_bridge_jobs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "externalDraftId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "resumeUrlEncrypted" TEXT NOT NULL,
    "resumeExpiresAt" TIMESTAMP(3),
    "resumeStatus" "ResumeStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "n8n_bridge_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_receipts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "platformPostId" TEXT,
    "platformUrl" TEXT,
    "status" "PublishStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "n8nExecutionId" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_revisions_contentId_version_key" ON "content_revisions"("contentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "n8n_bridge_jobs_eventId_key" ON "n8n_bridge_jobs"("eventId");

-- CreateIndex
CREATE INDEX "n8n_bridge_jobs_externalDraftId_idx" ON "n8n_bridge_jobs"("externalDraftId");

-- CreateIndex
CREATE INDEX "n8n_bridge_jobs_resumeStatus_nextAttemptAt_idx" ON "n8n_bridge_jobs"("resumeStatus", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextAttemptAt_idx" ON "outbox_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateId_idx" ON "outbox_events"("aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "publish_receipts_eventId_key" ON "publish_receipts"("eventId");

-- CreateIndex
CREATE INDEX "publish_receipts_contentId_idx" ON "publish_receipts"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "contents_externalDraftId_key" ON "contents"("externalDraftId");

-- CreateIndex
CREATE INDEX "contents_n8nWorkflowId_idx" ON "contents"("n8nWorkflowId");

-- CreateIndex
CREATE INDEX "contents_n8nExecutionId_idx" ON "contents"("n8nExecutionId");

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "content_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n8n_bridge_jobs" ADD CONSTRAINT "n8n_bridge_jobs_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_receipts" ADD CONSTRAINT "publish_receipts_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_receipts" ADD CONSTRAINT "publish_receipts_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "content_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
