import { evaluateResearchBrief } from '@/lib/research-specialist/readiness';
import type { ResearchBriefReadiness } from '@/lib/research-specialist/contracts';
import type { ChiefOfStaffDepartment } from '@/lib/chief-of-staff/contracts';

export function researchReadinessForTriage(
  projectId: string,
  request: string,
  department: ChiefOfStaffDepartment
): ResearchBriefReadiness | null {
  if (department !== 'RESEARCH') return null;
  return evaluateResearchBrief({
    schemaVersion: '1',
    projectId,
    title: request.trim().slice(0, 200),
  });
}
