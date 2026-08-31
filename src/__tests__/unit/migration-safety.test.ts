import fs from 'fs';
import path from 'path';

/**
 * Assert expand → backfill → contract ordering for the Agent HQ migration.
 */
describe('migration safety: company_project_agent_hq', () => {
  const migrationPath = path.join(
    process.cwd(),
    'prisma/migrations/20260820000000_company_project_agent_hq/migration.sql'
  );

  it('exists and follows expand → backfill → contract', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const expandIdx = sql.indexOf('Section A: EXPAND');
    const backfillIdx = sql.indexOf('Section B: BACKFILL');
    const contractIdx = sql.indexOf('Section C: CONTRACT');
    expect(expandIdx).toBeGreaterThanOrEqual(0);
    expect(backfillIdx).toBeGreaterThan(expandIdx);
    expect(contractIdx).toBeGreaterThan(backfillIdx);

    const addProjectId = sql.indexOf('ALTER TABLE "contents" ADD COLUMN "projectId"');
    const backfillContents = sql.indexOf(
      'UPDATE "contents" SET "projectId" = \'proj_aeon\''
    );
    const setNotNull = sql.indexOf(
      'ALTER TABLE "contents" ALTER COLUMN "projectId" SET NOT NULL'
    );
    expect(addProjectId).toBeGreaterThanOrEqual(0);
    expect(backfillContents).toBeGreaterThan(addProjectId);
    expect(setNotNull).toBeGreaterThan(backfillContents);
  });

  it('does not drop existing product tables', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/DROP TABLE "contents"/i);
    expect(sql).not.toMatch(/DROP TABLE "campaigns"/i);
    expect(sql).not.toMatch(/DROP TABLE "users"/i);
  });
});
