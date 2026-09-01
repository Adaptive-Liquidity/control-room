jest.mock('@/lib/prisma', () => {
  const model = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  });
  return {
    prisma: {
      content: model(),
      contentRevision: model(),
      campaign: model(),
      experiment: model(),
      asset: model(),
      metricSnapshot: model(),
      attributionEvent: model(),
      activityLog: model(),
      agentRun: model(),
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    },
  };
});

jest.mock('@/lib/pusher/server', () => ({
  emitContentCreated: jest.fn(),
  emitContentUpdated: jest.fn(),
}));

jest.mock('@/lib/guardian/guardian.service', () => ({
  guardianService: {
    checkContent: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { guardianService } from '@/lib/guardian/guardian.service';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationServiceError,
  contentService,
} from '@/services/content.service';

const mockedPrisma = prisma as unknown as {
  content: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  contentRevision: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  campaign: { findFirst: jest.Mock; findUnique: jest.Mock };
  activityLog: { create: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
};

const draftRow = {
  id: 'c1',
  authorId: 'ed-1',
  status: 'DRAFT',
  projectId: 'project-1',
  title: 'T',
  body: 'B',
  type: 'TWITTER_THREAD',
  channel: 'TWITTER',
  currentRevisionId: 'r1',
};

describe('contentService.update status lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma)
    );
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'c1',
        status: 'DRAFT',
        title: 'T',
        body: 'B',
        type: 'TWITTER_THREAD',
        channel: 'TWITTER',
      },
    ]);
    mockedPrisma.activityLog.create.mockResolvedValue({});
  });

  it('rejects campaignId-only PATCH on PENDING_REVIEW for a Studio mutator', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue({
      ...draftRow,
      status: 'PENDING_REVIEW',
    });

    await expect(
      contentService.update(
        'c1',
        { campaignId: 'camp-1' },
        'ed-1',
        'project-1',
        { role: 'EDITOR' }
      )
    ).rejects.toBeInstanceOf(ConflictError);

    expect(mockedPrisma.campaign.findFirst).not.toHaveBeenCalled();
    expect(mockedPrisma.campaign.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.content.update).not.toHaveBeenCalled();
  });

  it('rejects body-field writes on PENDING_REVIEW even without a mutator', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue({
      ...draftRow,
      status: 'PENDING_REVIEW',
    });

    await expect(
      contentService.update('c1', { title: 'New title' }, 'ed-1', 'project-1')
    ).rejects.toBeInstanceOf(ConflictError);

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockedPrisma.contentRevision.create).not.toHaveBeenCalled();
  });

  it('skips createRevision when title/body/type/channel are unchanged', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue(draftRow);
    mockedPrisma.content.update.mockResolvedValue({
      ...draftRow,
      currentRevisionId: 'r1',
    });

    await contentService.update(
      'c1',
      {
        title: 'T',
        body: 'B',
        type: 'TWITTER_THREAD',
        channel: 'TWITTER',
      },
      'ed-1',
      'project-1',
      { role: 'EDITOR' }
    );

    expect(mockedPrisma.$transaction).toHaveBeenCalled();
    expect(mockedPrisma.contentRevision.create).not.toHaveBeenCalled();
    expect(mockedPrisma.content.update).toHaveBeenCalled();
  });

  it('refuses a revision write when the locked row is no longer editable', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue(draftRow);
    mockedPrisma.$queryRaw.mockResolvedValue([{ id: 'c1', status: 'PENDING_REVIEW' }]);

    await expect(
      contentService.update(
        'c1',
        { title: 'New title', body: 'B', type: 'TWITTER_THREAD', channel: 'TWITTER' },
        'ed-1',
        'project-1',
        { role: 'EDITOR' }
      )
    ).rejects.toBeInstanceOf(ConflictError);

    expect(mockedPrisma.contentRevision.create).not.toHaveBeenCalled();
  });

  it('builds the revision from the locked row, not the pre-transaction snapshot', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue({
      ...draftRow,
      title: 'Stale title',
      body: 'Stale body',
    });
    mockedPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'c1',
        status: 'DRAFT',
        title: 'Locked title',
        body: 'Locked body',
        type: 'TWITTER_THREAD',
        channel: 'TWITTER',
      },
    ]);
    (guardianService.checkContent as jest.Mock).mockResolvedValue({
      score: 100,
      result: 'ALLOW',
      policyVersion: 'test',
      checks: {},
      flags: [],
    });
    mockedPrisma.contentRevision.findFirst.mockResolvedValue({ version: 1 });
    mockedPrisma.contentRevision.create.mockResolvedValue({ id: 'r2', version: 2 });
    mockedPrisma.content.update.mockResolvedValue({
      ...draftRow,
      title: 'Locked title',
      body: 'New body',
    });

    await contentService.update(
      'c1',
      { body: 'New body' },
      'ed-1',
      'project-1',
      { role: 'EDITOR' }
    );

    expect(mockedPrisma.contentRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Locked title',
          body: 'New body',
        }),
      })
    );
  });

  it('omits password from PATCH author includes', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue(draftRow);
    mockedPrisma.content.update.mockResolvedValue({
      ...draftRow,
      author: { id: 'ed-1', name: 'Editor', email: 'editor@aeon.test' },
    });

    await contentService.update(
      'c1',
      { title: 'T', body: 'B', type: 'TWITTER_THREAD', channel: 'TWITTER' },
      'ed-1',
      'project-1',
      { role: 'EDITOR' }
    );

    const includeArg = mockedPrisma.content.update.mock.calls[0][0].include as {
      author: unknown;
    };
    expect(includeArg.author).not.toBe(true);
    expect(includeArg.author).toEqual(
      expect.objectContaining({
        select: expect.objectContaining({ id: true, email: true }),
      })
    );
  });

  it('throws 400 when a supplied title is whitespace', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue(draftRow);

    await expect(
      contentService.update('c1', { title: '   ' }, 'ed-1', 'project-1', { role: 'EDITOR' })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(mockedPrisma.contentRevision.create).not.toHaveBeenCalled();
  });

  it('throws 404 when content is missing', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue(null);

    await expect(
      contentService.update('missing', { title: 'Hi' }, 'ed-1', 'project-1', {
        role: 'EDITOR',
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('contentService.create Guardian BLOCK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prisma)
    );
    mockedPrisma.content.create.mockResolvedValue({
      id: 'c1',
      projectId: 'project-1',
      status: 'PENDING_REVIEW',
    });
    mockedPrisma.contentRevision.findFirst.mockResolvedValue(null);
    mockedPrisma.contentRevision.create.mockResolvedValue({ id: 'r1', version: 1 });
    mockedPrisma.content.update.mockResolvedValue({});
    mockedPrisma.activityLog.create.mockResolvedValue({});
  });

  it('rolls back first-time submit when Guardian is BLOCK', async () => {
    (guardianService.checkContent as jest.Mock).mockResolvedValue({
      score: 0,
      result: 'BLOCK',
      policyVersion: 'test',
      checks: {},
      flags: [],
    });

    await expect(
      contentService.create({
        title: 'guaranteed 50% APY',
        body: 'guaranteed 50% APY forever',
        type: 'TWITTER_THREAD',
        channel: 'TWITTER',
        authorId: 'ed-1',
        projectId: 'project-1',
        status: 'PENDING_REVIEW',
      })
    ).rejects.toBeInstanceOf(ValidationServiceError);

    expect(mockedPrisma.activityLog.create).not.toHaveBeenCalled();
  });

  it('persists a DRAFT even when Guardian is BLOCK', async () => {
    (guardianService.checkContent as jest.Mock).mockResolvedValue({
      score: 0,
      result: 'BLOCK',
      policyVersion: 'test',
      checks: {},
      flags: [],
    });
    mockedPrisma.content.create.mockResolvedValue({
      id: 'c1',
      projectId: 'project-1',
      status: 'DRAFT',
    });
    mockedPrisma.content.findUniqueOrThrow.mockResolvedValue({
      id: 'c1',
      projectId: 'project-1',
      status: 'DRAFT',
      currentRevisionId: 'r1',
    });

    const created = await contentService.create({
      title: 'guaranteed 50% APY',
      body: 'guaranteed 50% APY forever',
      type: 'TWITTER_THREAD',
      channel: 'TWITTER',
      authorId: 'ed-1',
      projectId: 'project-1',
      status: 'DRAFT',
    });

    expect(created.id).toBe('c1');
    expect(mockedPrisma.activityLog.create).toHaveBeenCalled();
  });
});
