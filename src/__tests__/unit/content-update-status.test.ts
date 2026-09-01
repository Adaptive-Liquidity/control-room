jest.mock('@/lib/prisma', () => {
  const model = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  });
  return {
    prisma: {
      content: model(),
      campaign: model(),
      experiment: model(),
      asset: model(),
      metricSnapshot: model(),
      attributionEvent: model(),
      activityLog: model(),
      agentRun: model(),
      $transaction: jest.fn(),
    },
  };
});

jest.mock('@/lib/pusher/server', () => ({
  emitContentCreated: jest.fn(),
  emitContentUpdated: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { ConflictError, contentService } from '@/services/content.service';

const mockedPrisma = prisma as unknown as {
  content: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  campaign: { findFirst: jest.Mock; findUnique: jest.Mock };
};

describe('contentService.update status lock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects campaignId-only PATCH on PENDING_REVIEW for a Studio mutator', async () => {
    mockedPrisma.content.findFirst.mockResolvedValue({
      id: 'c1',
      authorId: 'ed-1',
      status: 'PENDING_REVIEW',
      projectId: 'project-1',
      title: 'T',
      body: 'B',
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
});
