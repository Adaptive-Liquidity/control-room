-- Phase 2 product surfaces (PR C–H): Assets, AgentRun, Campaign controls,
-- MetricSnapshot, AttributionEvent, Experiment, OrgSetting.
-- Apply with: npx prisma migrate deploy

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_APPROVAL', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AttributionKind" AS ENUM ('VIEW', 'CLICK', 'SIGNUP', 'ACTIVATION', 'INTEGRATION', 'TREASURY');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('PLANNING', 'RUNNING', 'COMPLETE', 'CANCELLED');

-- AlterEnum ActivityType
ALTER TYPE "ActivityType" ADD VALUE 'AGENT_RUN_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'CAMPAIGN_PAUSED';
ALTER TYPE "ActivityType" ADD VALUE 'CAMPAIGN_STOPPED';
ALTER TYPE "ActivityType" ADD VALUE 'RESUME_DELIVERED';
ALTER TYPE "ActivityType" ADD VALUE 'PUBLISH_RECEIPT';
ALTER TYPE "ActivityType" ADD VALUE 'GUARDIAN_BLOCK';
ALTER TYPE "ActivityType" ADD VALUE 'ASSET_UPLOADED';
ALTER TYPE "ActivityType" ADD VALUE 'EXPERIMENT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE 'EXPERIMENT_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE 'METRICS_INGESTED';

-- AlterTable campaigns
ALTER TABLE "campaigns" ADD COLUMN "objective" TEXT,
ADD COLUMN "thesis" TEXT,
ADD COLUMN "approvalPolicy" JSONB,
ADD COLUMN "dailyContentLimit" INTEGER,
ADD COLUMN "dailyPublishLimit" INTEGER,
ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoGenDisabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "emergencyStopped" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable assets
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "originalFilename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable content_assets
CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "contentRevisionId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable agent_runs
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentName" TEXT,
    "workflowId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "latencyMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "modelAlias" TEXT,
    "promptVersion" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable metric_snapshots
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contentId" TEXT,
    "campaignId" TEXT,
    "channel" "Channel",
    "observedAt" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "integrations" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable attribution_events
CREATE TABLE "attribution_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "AttributionKind" NOT NULL,
    "contentId" TEXT,
    "campaignId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION,
    "currency" TEXT,
    "sessionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribution_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable experiments
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "channel" "Channel",
    "status" "ExperimentStatus" NOT NULL DEFAULT 'PLANNING',
    "variants" JSONB NOT NULL,
    "primaryMetric" TEXT NOT NULL,
    "guardrailMetrics" JSONB,
    "outcome" TEXT,
    "decision" TEXT,
    "liftPct" DOUBLE PRECISION,
    "confidencePct" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable org_settings
CREATE TABLE "org_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_settings_pkey" PRIMARY KEY ("id")
);

-- Indexes / uniques
CREATE UNIQUE INDEX "assets_storageKey_key" ON "assets"("storageKey");
CREATE INDEX "assets_uploadedById_idx" ON "assets"("uploadedById");

CREATE UNIQUE INDEX "content_assets_contentRevisionId_assetId_key" ON "content_assets"("contentRevisionId", "assetId");
CREATE INDEX "content_assets_assetId_idx" ON "content_assets"("assetId");

CREATE UNIQUE INDEX "agent_runs_eventId_key" ON "agent_runs"("eventId");
CREATE INDEX "agent_runs_agentId_createdAt_idx" ON "agent_runs"("agentId", "createdAt");
CREATE INDEX "agent_runs_workflowId_executionId_idx" ON "agent_runs"("workflowId", "executionId");
CREATE INDEX "agent_runs_status_createdAt_idx" ON "agent_runs"("status", "createdAt");

CREATE UNIQUE INDEX "metric_snapshots_eventId_key" ON "metric_snapshots"("eventId");
CREATE INDEX "metric_snapshots_contentId_observedAt_idx" ON "metric_snapshots"("contentId", "observedAt");
CREATE INDEX "metric_snapshots_campaignId_observedAt_idx" ON "metric_snapshots"("campaignId", "observedAt");
CREATE INDEX "metric_snapshots_observedAt_idx" ON "metric_snapshots"("observedAt");

CREATE UNIQUE INDEX "attribution_events_eventId_key" ON "attribution_events"("eventId");
CREATE INDEX "attribution_events_contentId_occurredAt_idx" ON "attribution_events"("contentId", "occurredAt");
CREATE INDEX "attribution_events_campaignId_occurredAt_idx" ON "attribution_events"("campaignId", "occurredAt");
CREATE INDEX "attribution_events_kind_occurredAt_idx" ON "attribution_events"("kind", "occurredAt");

CREATE INDEX "experiments_status_idx" ON "experiments"("status");

CREATE UNIQUE INDEX "org_settings_key_key" ON "org_settings"("key");

-- ForeignKeys
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_contentRevisionId_fkey" FOREIGN KEY ("contentRevisionId") REFERENCES "content_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "experiments" ADD CONSTRAINT "experiments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
