import { z } from 'zod';

export const chiefOfStaffDepartmentSchema = z.enum([
  'FOUNDER',
  'PRODUCT',
  'DESIGN',
  'ENGINEERING',
  'RESEARCH',
  'MARKETING',
  'SALES',
  'OPERATIONS',
  'FINANCE',
  'LEGAL_RISK',
]);

export const chiefOfStaffRiskSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const chiefOfStaffIntakeSchema = z.object({
  request: z.string().trim().min(3).max(10_000),
  projectId: z.string().min(1),
  campaignId: z.string().min(1).optional(),
  urgency: z.number().int().min(1).max(5).default(3),
  impact: z.number().int().min(1).max(5).default(3),
  effort: z.number().int().min(1).max(5).default(3),
});

export const chiefOfStaffTriageSchema = z.object({
  department: chiefOfStaffDepartmentSchema,
  riskTier: chiefOfStaffRiskSchema,
  approvalRequired: z.boolean(),
  priorityScore: z.number().int(),
  priority: z.enum(['NOW', 'NEXT', 'LATER']),
  nextAction: z.string().min(1),
  reasons: z.array(z.string()).min(1),
});

export type ChiefOfStaffIntake = z.infer<typeof chiefOfStaffIntakeSchema>;
export type ChiefOfStaffTriage = z.infer<typeof chiefOfStaffTriageSchema>;
export type ChiefOfStaffDepartment = z.infer<typeof chiefOfStaffDepartmentSchema>;
export type ChiefOfStaffRisk = z.infer<typeof chiefOfStaffRiskSchema>;
