-- Expand / backfill / contract: Company → Project Agent HQ foundation
-- Section A: EXPAND (nullable columns + new tables)

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ContextStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "activeContextVersionId" TEXT,
    "setupCompletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
CREATE UNIQUE INDEX "companies_activeContextVersionId_key" ON "companies"("activeContextVersionId");

CREATE TABLE "company_context_versions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContextStatus" NOT NULL DEFAULT 'DRAFT',
    "pack" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_context_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_context_versions_companyId_version_key" ON "company_context_versions"("companyId", "version");
CREATE INDEX "company_context_versions_companyId_status_idx" ON "company_context_versions"("companyId", "status");

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "activeContextVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_companyId_slug_key" ON "projects"("companyId", "slug");
CREATE UNIQUE INDEX "projects_activeContextVersionId_key" ON "projects"("activeContextVersionId");
CREATE INDEX "projects_companyId_status_idx" ON "projects"("companyId", "status");

CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");

CREATE TABLE "project_context_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContextStatus" NOT NULL DEFAULT 'DRAFT',
    "pack" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "summary" TEXT,
    "createdById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_context_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_context_versions_projectId_version_key" ON "project_context_versions"("projectId", "version");
CREATE INDEX "project_context_versions_projectId_status_idx" ON "project_context_versions"("projectId", "status");

CREATE TABLE "project_settings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_settings_projectId_key_key" ON "project_settings"("projectId", "key");

CREATE TABLE "agent_departments" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_departments_key_key" ON "agent_departments"("key");

ALTER TABLE "users" ADD COLUMN "lastActiveProjectId" TEXT;

ALTER TABLE "contents" ADD COLUMN "projectId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN "projectId" TEXT;
ALTER TABLE "assets" ADD COLUMN "projectId" TEXT;
ALTER TABLE "experiments" ADD COLUMN "projectId" TEXT;
ALTER TABLE "metric_snapshots" ADD COLUMN "projectId" TEXT;
ALTER TABLE "attribution_events" ADD COLUMN "projectId" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "projectId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "projectId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "agent_runs" ADD COLUMN "contextPackHash" TEXT;
ALTER TABLE "agents" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "guardian_rules" ADD COLUMN "companyId" TEXT;
ALTER TABLE "guardian_rules" ADD COLUMN "projectId" TEXT;

-- Section B: BACKFILL seed Adaptive Liquidity + AEON and assign orphan rows

INSERT INTO "companies" ("id", "slug", "name", "legalName", "setupCompletedAt", "createdAt", "updatedAt")
VALUES ('cmpy_adaptive_liquidity', 'adaptive-liquidity', 'Adaptive Liquidity', 'Adaptive Liquidity Labs', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "company_context_versions" ("id", "companyId", "version", "status", "pack", "contentHash", "summary", "publishedAt", "createdAt")
VALUES (
  'ccv_adaptive_v1',
  'cmpy_adaptive_liquidity',
  1,
  'PUBLISHED',
  '{"schemaVersion":"1","promptCore":{"identity":{"name":"Adaptive Liquidity","legalName":"Adaptive Liquidity Labs","oneLiner":"Treasury automation and control-plane infrastructure"},"voice":{"tone":"precise, humble, architectural","do":["cite evidence","use maturity bands"],"dont":["to the moon","ngmi","wagmi","laser eyes","ape in","shill","amazing","incredible","revolutionary","game-changing","disruptive"]},"prohibitions":{"forbiddenClaims":["guaranteed yield","passive income","risk free","financial advice"],"requiredDisclaimers":[]},"keyFacts":[]},"reference":{"glossary":[],"links":[],"handles":[]}}'::jsonb,
  'sha256:seed-company-adaptive-liquidity-v1',
  'Seeded company pack v1',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE "companies" SET "activeContextVersionId" = 'ccv_adaptive_v1' WHERE "id" = 'cmpy_adaptive_liquidity';

INSERT INTO "projects" ("id", "companyId", "slug", "name", "status", "createdAt", "updatedAt")
VALUES ('proj_aeon', 'cmpy_adaptive_liquidity', 'aeon', 'AEON Control Room', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "project_context_versions" ("id", "projectId", "version", "status", "pack", "contentHash", "summary", "publishedAt", "createdAt")
VALUES (
  'pcv_aeon_v1',
  'proj_aeon',
  1,
  'PUBLISHED',
  '{"schemaVersion":"1","promptCore":{"identity":{"name":"AEON Control Room","oneLiner":"Marketing command center and policy plane"},"voice":{},"prohibitions":{"forbiddenClaims":["buy aeon"],"requiredDisclaimers":[]},"keyFacts":[]},"reference":{"glossary":[],"links":[],"handles":[]}}'::jsonb,
  'sha256:seed-project-aeon-v1',
  'Seeded project pack v1',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

UPDATE "projects" SET "activeContextVersionId" = 'pcv_aeon_v1' WHERE "id" = 'proj_aeon';

INSERT INTO "project_members" ("id", "projectId", "userId", "role", "createdAt")
SELECT 'pm_' || u."id", 'proj_aeon', u."id", u."role", CURRENT_TIMESTAMP FROM "users" u;

UPDATE "users" SET "lastActiveProjectId" = 'proj_aeon';

UPDATE "contents" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "campaigns" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "assets" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "experiments" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "metric_snapshots" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "attribution_events" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "activity_logs" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;
UPDATE "agent_runs" SET "projectId" = 'proj_aeon' WHERE "projectId" IS NULL;

-- Guardian reclass: brand voice → company; buy aeon → project; regulatory floor stays global
-- Brand voice → company; regulatory maturity-band patterns stay global (companyId NULL)
UPDATE "guardian_rules" SET "companyId" = 'cmpy_adaptive_liquidity'
WHERE "type" = 'BRAND_VOICE' OR "pattern" IN ('to the moon','moonshot','ngmi','wagmi','laser eyes','ape in','apeing','shill','shilling');

UPDATE "guardian_rules" SET "projectId" = 'proj_aeon' WHERE lower("pattern") = 'buy aeon';

UPDATE "guardian_rules" SET "message" = replace("message", 'AEON voice is precise, humble, architectural.', 'Adaptive Liquidity voice is precise, humble, architectural.')
WHERE "type" = 'BRAND_VOICE';

INSERT INTO "agent_departments" ("id", "key", "name", "isActive", "createdAt", "updatedAt") VALUES
  ('adept_content', 'content', 'Content', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('adept_research', 'research', 'Research', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('adept_publish', 'publish', 'Publish', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('adept_guardian', 'guardian', 'Guardian', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('adept_analytics', 'analytics', 'Analytics', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "agents" SET "departmentId" = 'adept_content' WHERE "type" = 'CREATOR';
UPDATE "agents" SET "departmentId" = 'adept_publish' WHERE "type" = 'PUBLISHER';
UPDATE "agents" SET "departmentId" = 'adept_analytics' WHERE "type" = 'ANALYZER';
UPDATE "agents" SET "departmentId" = 'adept_guardian' WHERE "type" = 'GUARDIAN';
UPDATE "agents" SET "departmentId" = 'adept_research' WHERE "type" = 'RESEARCHER';

-- Section C: CONTRACT (NOT NULL + FKs + indexes)

ALTER TABLE "contents" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "campaigns" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "assets" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "experiments" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "metric_snapshots" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "attribution_events" ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "companies" ADD CONSTRAINT "companies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "companies" ADD CONSTRAINT "companies_activeContextVersionId_fkey" FOREIGN KEY ("activeContextVersionId") REFERENCES "company_context_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_context_versions" ADD CONSTRAINT "company_context_versions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_context_versions" ADD CONSTRAINT "company_context_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_activeContextVersionId_fkey" FOREIGN KEY ("activeContextVersionId") REFERENCES "project_context_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_context_versions" ADD CONSTRAINT "project_context_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_context_versions" ADD CONSTRAINT "project_context_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contents" ADD CONSTRAINT "contents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "agent_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guardian_rules" ADD CONSTRAINT "guardian_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guardian_rules" ADD CONSTRAINT "guardian_rules_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "campaigns_id_projectId_key" ON "campaigns"("id", "projectId");
CREATE INDEX "contents_projectId_createdAt_idx" ON "contents"("projectId", "createdAt");
CREATE INDEX "campaigns_projectId_createdAt_idx" ON "campaigns"("projectId", "createdAt");
CREATE INDEX "assets_projectId_createdAt_idx" ON "assets"("projectId", "createdAt");
CREATE INDEX "experiments_projectId_createdAt_idx" ON "experiments"("projectId", "createdAt");
CREATE INDEX "metric_snapshots_projectId_observedAt_idx" ON "metric_snapshots"("projectId", "observedAt");
CREATE INDEX "attribution_events_projectId_occurredAt_idx" ON "attribution_events"("projectId", "occurredAt");
CREATE INDEX "activity_logs_projectId_createdAt_idx" ON "activity_logs"("projectId", "createdAt");
CREATE INDEX "agent_runs_projectId_createdAt_idx" ON "agent_runs"("projectId", "createdAt");
CREATE INDEX "agent_runs_campaignId_createdAt_idx" ON "agent_runs"("campaignId", "createdAt");
CREATE INDEX "agents_departmentId_idx" ON "agents"("departmentId");
CREATE INDEX "guardian_rules_companyId_idx" ON "guardian_rules"("companyId");
CREATE INDEX "guardian_rules_projectId_idx" ON "guardian_rules"("projectId");

-- Composite FK: content.campaign must belong to same project
ALTER TABLE "contents" DROP CONSTRAINT IF EXISTS "contents_campaignId_fkey";
ALTER TABLE "contents" ADD CONSTRAINT "contents_campaign_same_project"
  FOREIGN KEY ("campaignId", "projectId") REFERENCES "campaigns"("id", "projectId") ON DELETE SET NULL ON UPDATE CASCADE;
