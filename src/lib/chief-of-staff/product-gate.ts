import { evaluateProductBrief } from '@/lib/product-specialist/readiness';
import type { ProductBriefReadiness } from '@/lib/product-specialist/contracts';
import type { ChiefOfStaffDepartment } from '@/lib/chief-of-staff/contracts';

export function productReadinessForTriage(
  projectId: string,
  request: string,
  department: ChiefOfStaffDepartment
): ProductBriefReadiness | null {
  if (department !== 'PRODUCT') return null;
  return evaluateProductBrief({
    schemaVersion: '1',
    projectId,
    title: request.trim().slice(0, 200),
  });
}
