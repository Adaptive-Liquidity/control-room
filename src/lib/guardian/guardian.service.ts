// src/lib/guardian/guardian.service.ts
import type { RuleSeverity, RuleType } from '@prisma/client';
import { prisma } from '../prisma';
import type { GuardianChecks, GuardianFlag } from '@/types';

const FORBIDDEN_WORDS = [
  'guaranteed yield', 'guaranteed apy', 'guaranteed return',
  'stablecoin', 'stable coin',
  'get rich', 'get rich quick',
  'passive income', 'passive earnings',
  'to the moon', 'moonshot',
  '100% safe', '100% secure', 'risk free',
  'buy aeon', 'buy now', 'dont miss out',
  'soon', 'coming soon', 'launching soon',
  'number go up', 'ngmi', 'wagmi',
  'laser eyes', 'ape in', 'apeing',
  'pump', 'pumping', 'dump',
  'rug', 'rugpull', 'rug pull',
  'shill', 'shilling',
  'financial advice', 'investment advice',
];

const YIELD_PATTERNS = [
  /\d+\s*%\s*(?:apy|apr|yield|return)/i,
  /(?:earn|get|receive)\s+\d+/i,
  /(?:guaranteed|promised|fixed)\s+(?:rate|return|yield)/i,
];

const REQUIRED_LABELS = ['maturity band', 'evidence tier', 'specified', 'simulated', 'integrated', 'verified'];

export class GuardianService {
  async checkContent(content: string, title: string): Promise<{ score: number; checks: GuardianChecks; flags: GuardianFlag[] }> {
    const flags: GuardianFlag[] = [];
    const checks: GuardianChecks = {
      forbiddenWords: true,
      maturityBand: true,
      sources: true,
      disclaimer: true,
      yieldPromise: true,
      brandVoice: true,
    };

    // Check 1: Forbidden words
    const lowerContent = (title + ' ' + content).toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      if (lowerContent.includes(word.toLowerCase())) {
        flags.push({
          rule: 'FORBIDDEN_WORD',
          severity: 'ERROR',
          message: `Forbidden word/phrase detected: "${word}"`,
        });
        checks.forbiddenWords = false;
      }
    }

    // Check 2: Yield promises
    for (const pattern of YIELD_PATTERNS) {
      if (pattern.test(content)) {
        flags.push({
          rule: 'YIELD_PROMISE',
          severity: 'CRITICAL',
          message: 'Potential yield/APY promise detected. Replace with "realized rate history" or "published telemetry".',
        });
        checks.yieldPromise = false;
      }
    }

    // Check 3: Maturity band labels
    const hasMaturityBand = REQUIRED_LABELS.some(label => lowerContent.includes(label));
    if (!hasMaturityBand && content.length > 200) {
      flags.push({
        rule: 'MATURITY_BAND',
        severity: 'WARNING',
        message: 'No maturity band label detected. Consider adding "Specified", "Simulated", "Integrated", or "Verified".',
      });
      checks.maturityBand = false;
    }

    // Check 4: Source citations
    const hasSources = /https?:\/\//.test(content) || /\(.*?\d{4}.*?\)/.test(content);
    if (!hasSources && content.length > 500) {
      flags.push({
        rule: 'SOURCE_CITATION',
        severity: 'WARNING',
        message: 'No source citations detected. Add URLs or academic references for claims.',
      });
      checks.sources = false;
    }

    // Check 5: Regulatory disclaimer
    const hasDisclaimer = lowerContent.includes('not financial advice') || 
                         lowerContent.includes('not investment advice') ||
                         lowerContent.includes('educational') ||
                         lowerContent.includes('consult qualified');
    if (!hasDisclaimer && content.length > 300) {
      flags.push({
        rule: 'DISCLAIMER',
        severity: 'INFO',
        message: 'Consider adding regulatory disclaimer for financial content.',
      });
      checks.disclaimer = false;
    }

    // Check 6: Brand voice consistency (basic)
    const hypeWords = ['amazing', 'incredible', 'revolutionary', 'game-changing', 'disruptive'];
    const hypeCount = hypeWords.filter(w => lowerContent.includes(w)).length;
    if (hypeCount > 2) {
      flags.push({
        rule: 'BRAND_VOICE',
        severity: 'WARNING',
        message: `Hype language detected (${hypeCount} instances). AEON voice is precise, humble, architectural.`,
      });
      checks.brandVoice = false;
    }

    // Calculate score
    const checkValues = Object.values(checks);
    const passedChecks = checkValues.filter(Boolean).length;
    const score = Math.round((passedChecks / checkValues.length) * 100);

    // Store in database
    await this.logCheck(content.length, score, flags.length);

    return { score, checks, flags };
  }

  async getRules() {
    return prisma.guardianRule.findMany({
      where: { isActive: true },
      orderBy: { severity: 'asc' },
    });
  }

  async addRule(data: {
    type: RuleType;
    pattern: string;
    severity: RuleSeverity;
    message: string;
    autoBlock: boolean;
  }) {
    return prisma.guardianRule.create({ data });
  }

  private async logCheck(contentLength: number, score: number, flags: number) {
    // Analytics tracking
    await prisma.activityLog.create({
      data: {
        type: 'SETTINGS_CHANGED',
        description: `Guardian check: score=${score}, flags=${flags}, length=${contentLength}`,
        metadata: { score, flags, contentLength },
      },
    });
  }
}

export const guardianService = new GuardianService();
