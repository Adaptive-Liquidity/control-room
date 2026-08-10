/**
 * Seed baseline Guardian rules (port of the former hard-coded lists).
 * Run AFTER applying the control_room_foundation migration:
 *   npx tsx scripts/seed-guardian-rules.ts
 */
import { PrismaClient, RuleAction, RuleSeverity, RuleType } from '@prisma/client';

const prisma = new PrismaClient();

type SeedRule = {
  type: RuleType;
  pattern: string;
  severity: RuleSeverity;
  action: RuleAction;
  message: string;
  autoBlock?: boolean;
};

const RULES: SeedRule[] = [
  // Forbidden phrases
  ...[
    'guaranteed yield',
    'guaranteed apy',
    'guaranteed return',
    'stablecoin',
    'stable coin',
    'get rich',
    'get rich quick',
    'passive income',
    'passive earnings',
    'to the moon',
    'moonshot',
    '100% safe',
    '100% secure',
    'risk free',
    'buy aeon',
    'buy now',
    'dont miss out',
    'soon',
    'coming soon',
    'launching soon',
    'number go up',
    'ngmi',
    'wagmi',
    'laser eyes',
    'ape in',
    'apeing',
    'pump',
    'pumping',
    'dump',
    'rug',
    'rugpull',
    'rug pull',
    'shill',
    'shilling',
    'financial advice',
    'investment advice',
  ].map(
    (pattern): SeedRule => ({
      type: 'FORBIDDEN_WORD',
      pattern,
      severity: 'ERROR',
      action: 'REVIEW',
      message: `Forbidden word/phrase detected: "${pattern}"`,
    })
  ),

  // Yield / APY promises
  {
    type: 'YIELD_PROMISE',
    pattern: String.raw`/\d+\s*%\s*(?:apy|apr|yield|return)/i`,
    severity: 'CRITICAL',
    action: 'BLOCK',
    autoBlock: true,
    message:
      'Potential yield/APY promise detected. Replace with "realized rate history" or "published telemetry".',
  },
  {
    type: 'YIELD_PROMISE',
    pattern: String.raw`/(?:earn|get|receive)\s+\d+/i`,
    severity: 'CRITICAL',
    action: 'BLOCK',
    autoBlock: true,
    message: 'Potential numeric earn/get promise detected.',
  },
  {
    type: 'YIELD_PROMISE',
    pattern: String.raw`/(?:guaranteed|promised|fixed)\s+(?:rate|return|yield)/i`,
    severity: 'CRITICAL',
    action: 'BLOCK',
    autoBlock: true,
    message: 'Guaranteed/promised/fixed return language detected.',
  },

  // Maturity band presence labels
  ...['maturity band', 'evidence tier', 'specified', 'simulated', 'integrated', 'verified'].map(
    (pattern): SeedRule => ({
      type: 'MATURITY_BAND',
      pattern,
      severity: 'WARNING',
      action: 'REVIEW',
      message:
        'No maturity band label detected. Consider adding "Specified", "Simulated", "Integrated", or "Verified".',
    })
  ),

  // Brand voice hype
  ...['amazing', 'incredible', 'revolutionary', 'game-changing', 'disruptive'].map(
    (pattern): SeedRule => ({
      type: 'BRAND_VOICE',
      pattern,
      severity: 'WARNING',
      action: 'REVIEW',
      message: `Hype language detected ("${pattern}"). AEON voice is precise, humble, architectural.`,
    })
  ),
];

async function main() {
  let created = 0;
  for (const rule of RULES) {
    const existing = await prisma.guardianRule.findFirst({
      where: { type: rule.type, pattern: rule.pattern },
    });
    if (existing) continue;
    await prisma.guardianRule.create({
      data: {
        type: rule.type,
        pattern: rule.pattern,
        severity: rule.severity,
        action: rule.action,
        message: rule.message,
        autoBlock: rule.autoBlock ?? false,
        isActive: true,
      },
    });
    created++;
  }
  console.log(`Guardian rules seed complete. Created ${created} new rules (${RULES.length} defined).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
