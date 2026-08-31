import { createScopedDelegate, SCOPED_MODELS } from '@/lib/scope/scoped-prisma';

describe('scopedPrisma helpers', () => {
  it('lists known scoped models', () => {
    expect(SCOPED_MODELS.has('Content')).toBe(true);
    expect(SCOPED_MODELS.has('Campaign')).toBe(true);
    expect(SCOPED_MODELS.has('User')).toBe(false);
  });

  it('throws when projectId is empty at construction', () => {
    expect(() => createScopedDelegate('', { findMany: jest.fn() })).toThrow(
      /projectId/
    );
  });

  it('injects projectId into findMany where', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const scoped = createScopedDelegate('p1', { findMany });
    await scoped.findMany({ where: { status: 'DRAFT' } });
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1', status: 'DRAFT' },
    });
  });

  it('scope projectId wins over caller-supplied where.projectId', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const scoped = createScopedDelegate('p1', { findMany });
    await scoped.findMany({ where: { projectId: 'p2' } });
    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 'p1' },
    });
  });

  it('injects projectId into create data', async () => {
    const create = jest.fn().mockResolvedValue({ id: '1' });
    const scoped = createScopedDelegate('p1', { create });
    await scoped.create({ data: { title: 'x' } });
    expect(create).toHaveBeenCalledWith({
      data: { title: 'x', projectId: 'p1' },
    });
  });

  it('rejects create that tries to set a different projectId', () => {
    const create = jest.fn();
    const scoped = createScopedDelegate('p1', { create });
    expect(() =>
      scoped.create({ data: { title: 'x', projectId: 'p2' } })
    ).toThrow(/projectId/);
    expect(create).not.toHaveBeenCalled();
  });

  it('stamps projectId on createMany single object and array', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const scoped = createScopedDelegate('p1', { createMany });
    await scoped.createMany({ data: { title: 'x' } });
    expect(createMany).toHaveBeenCalledWith({
      data: { title: 'x', projectId: 'p1' },
    });
    await scoped.createMany({ data: [{ title: 'a' }, { title: 'b' }] });
    expect(createMany).toHaveBeenLastCalledWith({
      data: [
        { title: 'a', projectId: 'p1' },
        { title: 'b', projectId: 'p1' },
      ],
    });
  });

  it('scopes findFirstOrThrow / findUniqueOrThrow where clauses', async () => {
    const findFirstOrThrow = jest.fn().mockResolvedValue({ id: '1' });
    const findUniqueOrThrow = jest.fn();
    const scoped = createScopedDelegate('p1', { findFirstOrThrow, findUniqueOrThrow });
    await scoped.findUniqueOrThrow({ where: { id: 'c1' } });
    expect(findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'c1', projectId: 'p1' },
    });
    expect(findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('scopes update/delete/count where clauses', async () => {
    const update = jest.fn().mockResolvedValue({});
    const del = jest.fn().mockResolvedValue({});
    const count = jest.fn().mockResolvedValue(0);
    const scoped = createScopedDelegate('p1', {
      update,
      delete: del,
      count,
    });
    await scoped.update({ where: { id: 'c1' }, data: { title: 'y' } });
    await scoped.delete({ where: { id: 'c1' } });
    await scoped.count({ where: { status: 'DRAFT' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1', projectId: 'p1' },
      data: { title: 'y' },
    });
    expect(del).toHaveBeenCalledWith({
      where: { id: 'c1', projectId: 'p1' },
    });
    expect(count).toHaveBeenCalledWith({
      where: { projectId: 'p1', status: 'DRAFT' },
    });
  });
});
