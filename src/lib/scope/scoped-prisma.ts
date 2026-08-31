/** Models that must always be filtered / stamped with projectId. */
export const SCOPED_MODELS = new Set([
  'Content',
  'Campaign',
  'Experiment',
  'Asset',
  'MetricSnapshot',
  'AttributionEvent',
  'ActivityLog',
  'AgentRun',
]);

type Delegate = Record<string, (...args: any[]) => any>;

function mergeWhere(projectId: string, where: Record<string, unknown> | undefined) {
  return { ...(where ?? {}), projectId };
}

/**
 * Wrap a Prisma model delegate so reads/writes are forced to a projectId.
 * Prefer this over ad-hoc where clauses in routes/services.
 */
export function createScopedDelegate<T extends Delegate>(
  projectId: string,
  delegate: T
): T {
  if (!projectId || !projectId.trim()) {
    throw new Error('scopedPrisma requires a non-empty projectId');
  }

  const handler: ProxyHandler<T> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      const op = String(prop);

      return (...args: any[]) => {
        const arg0 = args[0] ?? {};

        if (op === 'create') {
          const data = { ...(arg0.data ?? {}) };
          if (data.projectId != null && data.projectId !== projectId) {
            throw new Error('Cannot create record for a different projectId');
          }
          data.projectId = projectId;
          return value.call(target, { ...arg0, data });
        }

        if (op === 'createMany') {
          const stamp = (row: Record<string, unknown>) => {
            if (row.projectId != null && row.projectId !== projectId) {
              throw new Error('Cannot create record for a different projectId');
            }
            return { ...row, projectId };
          };
          const data = Array.isArray(arg0.data)
            ? arg0.data.map(stamp)
            : arg0.data
              ? stamp(arg0.data)
              : arg0.data;
          return value.call(target, { ...arg0, data });
        }

        // findUnique cannot AND arbitrary fields — use findFirst with scoped where
        if (op === 'findUnique' && typeof target.findFirst === 'function') {
          const where = mergeWhere(projectId, arg0.where);
          return target.findFirst.call(target, { ...arg0, where });
        }

        if (
          (op === 'findUniqueOrThrow' || op === 'findFirstOrThrow') &&
          typeof target.findFirstOrThrow === 'function'
        ) {
          const where = mergeWhere(projectId, arg0.where);
          return target.findFirstOrThrow.call(target, { ...arg0, where });
        }

        if (
          op === 'findMany' ||
          op === 'findFirst' ||
          op === 'count' ||
          op === 'aggregate' ||
          op === 'groupBy' ||
          op === 'update' ||
          op === 'updateMany' ||
          op === 'delete' ||
          op === 'deleteMany' ||
          op === 'upsert'
        ) {
          const where = mergeWhere(projectId, arg0.where);
          if (op === 'upsert') {
            const create = { ...(arg0.create ?? {}), projectId };
            if (
              arg0.create?.projectId != null &&
              arg0.create.projectId !== projectId
            ) {
              throw new Error('Cannot create record for a different projectId');
            }
            return value.call(target, {
              ...arg0,
              where,
              create,
              update: arg0.update,
            });
          }
          return value.call(target, { ...arg0, where });
        }

        return value.apply(target, args);
      };
    },
  };

  return new Proxy(delegate, handler);
}

/**
 * Build a lightweight scoped client surface for common models.
 * Pass the real prisma instance; only listed models are wrapped.
 */
export function scopedPrisma(projectId: string, prisma: any) {
  if (!projectId || !projectId.trim()) {
    throw new Error('scopedPrisma requires a non-empty projectId');
  }

  return {
    content: createScopedDelegate(projectId, prisma.content),
    campaign: createScopedDelegate(projectId, prisma.campaign),
    experiment: createScopedDelegate(projectId, prisma.experiment),
    asset: createScopedDelegate(projectId, prisma.asset),
    metricSnapshot: createScopedDelegate(projectId, prisma.metricSnapshot),
    attributionEvent: createScopedDelegate(projectId, prisma.attributionEvent),
    activityLog: createScopedDelegate(projectId, prisma.activityLog),
    agentRun: createScopedDelegate(projectId, prisma.agentRun),
    // Unscoped pass-throughs for relations / users / agents registry
    user: prisma.user,
    agent: prisma.agent,
    $transaction: prisma.$transaction?.bind(prisma),
  };
}
