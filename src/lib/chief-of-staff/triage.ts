import {
  chiefOfStaffIntakeSchema,
  type ChiefOfStaffDepartment,
  type ChiefOfStaffIntake,
  type ChiefOfStaffRisk,
  type ChiefOfStaffTriage,
} from './contracts';

const DEPARTMENT_SIGNALS: Record<ChiefOfStaffDepartment, readonly string[]> = {
  FOUNDER: ['strategy', 'vision', 'fundraise', 'investor', 'board', 'priority', 'roadmap'],
  PRODUCT: ['product', 'feature', 'requirement', 'user story', 'backlog', 'customer problem'],
  DESIGN: ['design', 'ui', 'ux', 'brand', 'logo', 'prototype', 'figma', 'wireframe'],
  ENGINEERING: ['engineer', 'code', 'bug', 'api', 'database', 'deploy', 'repository', 'github'],
  RESEARCH: ['research', 'investigate', 'compare', 'competitor', 'market', 'evidence'],
  MARKETING: ['marketing', 'campaign', 'content', 'launch', 'ad', 'seo', 'social'],
  SALES: ['sales', 'lead', 'prospect', 'outreach', 'proposal', 'pipeline', 'crm'],
  OPERATIONS: ['operations', 'process', 'workflow', 'vendor', 'schedule', 'documentation'],
  FINANCE: ['finance', 'budget', 'invoice', 'expense', 'forecast', 'runway', 'payment'],
  LEGAL_RISK: ['legal', 'contract', 'privacy', 'compliance', 'terms', 'trademark', 'security'],
};

const NEXT_ACTION: Record<ChiefOfStaffDepartment, string> = {
  FOUNDER: 'Prepare a decision brief with options, tradeoffs, and a recommendation.',
  PRODUCT: 'Define the user problem, desired outcome, acceptance criteria, and dependencies.',
  DESIGN: 'Prepare the design brief and identify the smallest reviewable artifact.',
  ENGINEERING: 'Inspect the relevant system and prepare a scoped implementation plan.',
  RESEARCH: 'Create an evidence-backed research brief with sources and open questions.',
  MARKETING: 'Define the audience, message, channel, goal, and measurable success signal.',
  SALES: 'Qualify the opportunity and prepare the next customer-facing step for approval.',
  OPERATIONS: 'Document the workflow, owner, trigger, handoffs, and completion check.',
  FINANCE: 'Quantify cost, cash impact, assumptions, and the approval decision required.',
  LEGAL_RISK: 'Identify obligations and risks, then prepare the decision for human review.',
};

const CRITICAL_SIGNALS = [
  'delete database',
  'drop database',
  'production secret',
  'private key',
  'wire transfer',
];

const HIGH_RISK_SIGNALS = [
  'publish',
  'send email',
  'contact customer',
  'deploy production',
  'merge to main',
  'spend',
  'purchase',
  'payment',
  'sign contract',
  'legal',
  'customer data',
  'delete',
];

const MEDIUM_RISK_SIGNALS = ['create', 'change', 'update', 'implement', 'campaign', 'code'];

function matchesSignal(text: string, signal: string) {
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(text);
}

function containsSignal(text: string, signals: readonly string[]) {
  return signals.some((signal) => matchesSignal(text, signal));
}

function routeDepartment(text: string): { department: ChiefOfStaffDepartment; signalCount: number } {
  let selected: ChiefOfStaffDepartment = 'FOUNDER';
  let highestScore = 0;

  for (const [department, signals] of Object.entries(DEPARTMENT_SIGNALS) as Array<
    [ChiefOfStaffDepartment, readonly string[]]
  >) {
    const score = signals.filter((signal) => matchesSignal(text, signal)).length;
    if (score > highestScore) {
      selected = department;
      highestScore = score;
    }
  }

  return { department: selected, signalCount: highestScore };
}

function classifyRisk(text: string): ChiefOfStaffRisk {
  if (containsSignal(text, CRITICAL_SIGNALS)) return 'CRITICAL';
  if (containsSignal(text, HIGH_RISK_SIGNALS)) return 'HIGH';
  if (containsSignal(text, MEDIUM_RISK_SIGNALS)) return 'MEDIUM';
  return 'LOW';
}

export function triageFounderRequest(raw: ChiefOfStaffIntake): ChiefOfStaffTriage {
  const intake = chiefOfStaffIntakeSchema.parse(raw);
  const normalized = intake.request.toLowerCase();
  const { department, signalCount } = routeDepartment(normalized);
  const riskTier = classifyRisk(normalized);
  const priorityScore = intake.impact * 2 + intake.urgency - intake.effort;
  const priority = priorityScore >= 10 ? 'NOW' : priorityScore >= 6 ? 'NEXT' : 'LATER';
  const approvalRequired = riskTier === 'HIGH' || riskTier === 'CRITICAL';

  return {
    department,
    riskTier,
    approvalRequired,
    priorityScore,
    priority,
    nextAction: NEXT_ACTION[department],
    reasons: [
      signalCount > 0
        ? `Matched ${signalCount} ${department.toLowerCase().replace('_', '/')} signal${signalCount === 1 ? '' : 's'}.`
        : 'No specialist signal matched; routed to the founder for clarification.',
      approvalRequired
        ? `Human approval is required for ${riskTier.toLowerCase()}-risk work.`
        : `${riskTier[0]}${riskTier.slice(1).toLowerCase()}-risk preparation may proceed without an execution approval.`,
    ],
  };
}
