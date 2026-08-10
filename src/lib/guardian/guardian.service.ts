import type { GuardianRule, RuleAction, RuleSeverity, RuleType } from '@prisma/client';
import { prisma } from '../prisma';
import type { GuardianChecks, GuardianFlag } from '@/types';

/** Bump when Guardian matching / scoring logic changes. */
export const POLICY_VERSION = '2026-08-09.1';

export type GuardianCheckResult = {
  score: number;
  result: 'ALLOW' | 'REVIEW' | 'BLOCK';
  policyVersion: string;
  checks: GuardianChecks;
  flags: GuardianFlag[];
};

const SEVERITY_WEIGHT: Record<RuleSeverity, number> = {
  CRITICAL: 40,
  ERROR: 25,
  WARNING: 15,
  INFO: 5,
};

const CHECK_KEY_BY_TYPE: Partial<Record<RuleType, keyof GuardianChecks>> = {
  FORBIDDEN_WORD: 'forbiddenWords',
  YIELD_PROMISE: 'yieldPromise',
  MATURITY_BAND: 'maturityBand',
  REQUIRED_LABEL: 'maturityBand',
  REGULATORY_TERM: 'disclaimer',
  BRAND_VOICE: 'brandVoice',
};

/** Skip forbidden-phrase hits that are negated (e.g. "not financial advice"). */
export function isNegatedMatch(haystack: string, matchIndex: number): boolean {
  const before = haystack.slice(Math.max(0, matchIndex - 24), matchIndex);
  return /(?:^|[\s([{])(?:not|isn't|is\s+not)\s+$/i.test(before);
}

function findPatternMatches(haystack: string, pattern: string): number[] {
  const indexes: number[] = [];
  // Treat `/.../flags` as regex; otherwise literal case-insensitive substring.
  const regexLiteral = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexLiteral) {
    try {
      const re = new RegExp(regexLiteral[1], regexLiteral[2].includes('g') ? regexLiteral[2] : `${regexLiteral[2]}g`);
      let m: RegExpExecArray | null;
      while ((m = re.exec(haystack)) !== null) {
        indexes.push(m.index);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return indexes;
    } catch {
      // fall through to literal
    }
  }

  const needle = pattern.toLowerCase();
  const lower = haystack.toLowerCase();
  let from = 0;
  while (from <= lower.length) {
    const idx = lower.indexOf(needle, from);
    if (idx === -1) break;
    indexes.push(idx);
    from = idx + Math.max(needle.length, 1);
  }
  return indexes;
}

function deriveResult(
  findings: Array<{ severity: RuleSeverity; action: RuleAction }>
): 'ALLOW' | 'REVIEW' | 'BLOCK' {
  for (const f of findings) {
    if (f.severity === 'CRITICAL' && f.action === 'BLOCK') {
      return 'BLOCK';
    }
  }
  for (const f of findings) {
    if (f.action === 'BLOCK' || f.action === 'REVIEW') {
      return 'REVIEW';
    }
  }
  return 'ALLOW';
}

export class GuardianService {
  async checkContent(content: string, title: string): Promise<GuardianCheckResult> {
    const rules = await prisma.guardianRule.findMany({
      where: { isActive: true },
    });

    const flags: GuardianFlag[] = [];
    const checks: GuardianChecks = {
      forbiddenWords: true,
      maturityBand: true,
      sources: true,
      disclaimer: true,
      yieldPromise: true,
      brandVoice: true,
    };

    if (rules.length === 0) {
      flags.push({
        rule: 'NO_ACTIVE_POLICY',
        severity: 'CRITICAL',
        message: 'No active Guardian rules loaded. Failing closed to REVIEW.',
      });
      return {
        score: 0,
        result: 'REVIEW',
        policyVersion: POLICY_VERSION,
        checks: {
          forbiddenWords: false,
          maturityBand: false,
          sources: false,
          disclaimer: false,
          yieldPromise: false,
          brandVoice: false,
        },
        flags,
      };
    }

    const haystack = `${title} ${content}`;
    const findings: Array<{ severity: RuleSeverity; action: RuleAction }> = [];
    let brandVoiceHits = 0;
    let brandVoiceRepresentative: GuardianRule | null = null;

    for (const rule of rules) {
      if (rule.type === 'REQUIRED_LABEL' || rule.type === 'MATURITY_BAND') {
        // Presence rules are handled in a second pass below.
        continue;
      }

      const matches = findPatternMatches(haystack, rule.pattern);
      if (matches.length === 0) continue;

      let hit = false;
      for (const idx of matches) {
        if (rule.type === 'FORBIDDEN_WORD' || rule.type === 'REGULATORY_TERM') {
          if (isNegatedMatch(haystack, idx)) continue;
        }
        hit = true;
        break;
      }
      if (!hit) continue;

      if (rule.type === 'BRAND_VOICE') {
        brandVoiceHits += 1;
        brandVoiceRepresentative = brandVoiceRepresentative ?? rule;
        continue;
      }

      const failOnMatch =
        rule.type === 'FORBIDDEN_WORD' ||
        rule.type === 'YIELD_PROMISE' ||
        rule.type === 'REGULATORY_TERM';

      if (!failOnMatch) continue;

      findings.push({ severity: rule.severity, action: rule.action });
      flags.push({
        rule: rule.type,
        severity: rule.severity,
        message: rule.message.replace('%pattern%', rule.pattern),
      });
      const key = CHECK_KEY_BY_TYPE[rule.type];
      if (key) checks[key] = false;
    }

    // Brand voice: only fail when more than two distinct hype terms appear.
    if (brandVoiceHits > 2 && brandVoiceRepresentative) {
      findings.push({
        severity: brandVoiceRepresentative.severity,
        action: brandVoiceRepresentative.action,
      });
      flags.push({
        rule: 'BRAND_VOICE',
        severity: brandVoiceRepresentative.severity,
        message: `Hype language detected (${brandVoiceHits} instances). AEON voice is precise, humble, architectural.`,
      });
      checks.brandVoice = false;
    }

    // Presence rules: if any active MATURITY_BAND / REQUIRED_LABEL rule exists and
    // content is long enough, require at least one pattern match.
    this.applyPresenceRules(rules, haystack, content, checks, flags, findings);

    // Soft source check (not DB-driven historically; keep as WARN when long + no URL/year cite)
    if (content.length > 500) {
      const hasSources = /https?:\/\//.test(content) || /\(.*?\d{4}.*?\)/.test(content);
      if (!hasSources) {
        checks.sources = false;
        flags.push({
          rule: 'SOURCE_CITATION',
          severity: 'WARNING',
          message: 'No source citations detected. Add URLs or academic references for claims.',
        });
        findings.push({ severity: 'WARNING', action: 'REVIEW' });
      }
    }

    // Soft disclaimer presence for long financial-ish content
    if (content.length > 300) {
      const lower = haystack.toLowerCase();
      const hasDisclaimer =
        lower.includes('not financial advice') ||
        lower.includes('not investment advice') ||
        lower.includes('educational') ||
        lower.includes('consult qualified');
      if (!hasDisclaimer) {
        checks.disclaimer = false;
        flags.push({
          rule: 'DISCLAIMER',
          severity: 'INFO',
          message: 'Consider adding regulatory disclaimer for financial content.',
        });
        findings.push({ severity: 'INFO', action: 'REVIEW' });
      }
    }

    const weightSum = findings.reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0);
    const score = Math.max(0, Math.min(100, 100 - weightSum));
    const result = deriveResult(findings);

    await this.logCheck(content.length, score, flags.length, result);

    return {
      score,
      result,
      policyVersion: POLICY_VERSION,
      checks,
      flags,
    };
  }

  private applyPresenceRules(
    rules: GuardianRule[],
    haystack: string,
    content: string,
    checks: GuardianChecks,
    flags: GuardianFlag[],
    findings: Array<{ severity: RuleSeverity; action: RuleAction }>
  ) {
    const presenceRules = rules.filter(
      (r) => r.type === 'MATURITY_BAND' || r.type === 'REQUIRED_LABEL'
    );
    if (presenceRules.length === 0 || content.length <= 200) return;

    const anyPresent = presenceRules.some(
      (r) => findPatternMatches(haystack, r.pattern).length > 0
    );
    if (anyPresent) return;

    const representative = presenceRules[0];
    findings.push({ severity: representative.severity, action: representative.action });
    flags.push({
      rule: representative.type,
      severity: representative.severity,
      message: representative.message,
    });
    checks.maturityBand = false;
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
    action?: RuleAction;
  }) {
    return prisma.guardianRule.create({
      data: {
        type: data.type,
        pattern: data.pattern,
        severity: data.severity,
        message: data.message,
        autoBlock: data.autoBlock,
        action: data.action ?? (data.autoBlock ? 'BLOCK' : 'REVIEW'),
      },
    });
  }

  private async logCheck(
    contentLength: number,
    score: number,
    flags: number,
    result: string
  ) {
    await prisma.activityLog.create({
      data: {
        type: 'SETTINGS_CHANGED',
        description: `Guardian check: score=${score}, result=${result}, flags=${flags}, length=${contentLength}`,
        metadata: { score, flags, contentLength, result, policyVersion: POLICY_VERSION },
      },
    });
  }
}

export const guardianService = new GuardianService();
