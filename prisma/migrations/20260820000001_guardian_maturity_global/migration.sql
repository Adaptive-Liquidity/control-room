-- Repair: maturity-band regulatory patterns must remain global (companyId NULL).
-- Earlier HQ migration incorrectly scoped some of these to Adaptive Liquidity.
UPDATE "guardian_rules"
SET "companyId" = NULL
WHERE lower("pattern") IN (
  'maturity band',
  'evidence tier',
  'specified',
  'simulated',
  'integrated',
  'verified'
);
