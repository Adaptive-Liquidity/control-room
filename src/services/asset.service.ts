// src/services/asset.service.ts
import { prisma } from '@/lib/prisma';
import {
  MAX_ASSET_BYTES,
  buildStorageKey,
  createSignedUploadUrl,
  isAllowedMimeType,
  isStorageConfigured,
  verifyObjectExists,
} from '@/lib/firebase/admin';

export class AssetServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AssetServiceError';
    this.statusCode = statusCode;
  }
}

export class AssetService {
  async createUploadUrl(opts: {
    userId: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    if (!isStorageConfigured()) {
      throw new AssetServiceError('Object storage is not configured', 503);
    }
    if (!isAllowedMimeType(opts.mimeType)) {
      throw new AssetServiceError(`MIME type not allowed: ${opts.mimeType}`, 400);
    }
    if (!Number.isFinite(opts.sizeBytes) || opts.sizeBytes <= 0) {
      throw new AssetServiceError('sizeBytes must be a positive number', 400);
    }
    if (opts.sizeBytes > MAX_ASSET_BYTES) {
      throw new AssetServiceError(`File exceeds max size of ${MAX_ASSET_BYTES} bytes`, 400);
    }

    const storageKey = buildStorageKey({
      userId: opts.userId,
      originalFilename: opts.originalFilename,
      mimeType: opts.mimeType,
    });

    const signed = await createSignedUploadUrl({
      storageKey,
      mimeType: opts.mimeType,
      sizeBytes: opts.sizeBytes,
    });

    return {
      storageKey,
      uploadUrl: signed.uploadUrl,
      expiresAt: signed.expiresAt,
      maxBytes: MAX_ASSET_BYTES,
      mimeType: opts.mimeType,
    };
  }

  async completeUpload(opts: {
    userId: string;
    storageKey: string;
    originalFilename: string;
    mimeType: string;
    sha256?: string;
    projectId: string;
  }) {
    if (!isStorageConfigured()) {
      throw new AssetServiceError('Object storage is not configured', 503);
    }
    if (!opts.storageKey.startsWith(`assets/${opts.userId}/`)) {
      throw new AssetServiceError('storageKey does not belong to this user', 403);
    }
    if (!isAllowedMimeType(opts.mimeType)) {
      throw new AssetServiceError(`MIME type not allowed: ${opts.mimeType}`, 400);
    }

    const existing = await prisma.asset.findUnique({ where: { storageKey: opts.storageKey } });
    if (existing) {
      if (existing.projectId !== opts.projectId) {
        throw new AssetServiceError('Asset belongs to a different project', 403);
      }
      return { asset: existing, idempotent: true };
    }

    let verified;
    try {
      verified = await verifyObjectExists({
        storageKey: opts.storageKey,
        expectedMimeType: opts.mimeType,
        maxBytes: MAX_ASSET_BYTES,
      });
    } catch (err) {
      throw new AssetServiceError(
        err instanceof Error ? err.message : 'Failed to verify uploaded object',
        400
      );
    }

    const asset = await prisma.asset.create({
      data: {
        storageKey: opts.storageKey,
        mimeType: opts.mimeType,
        sizeBytes: verified.sizeBytes,
        sha256: opts.sha256 ?? null,
        originalFilename: opts.originalFilename,
        uploadedById: opts.userId,
        projectId: opts.projectId,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: opts.userId,
        projectId: opts.projectId,
        type: 'ASSET_UPLOADED',
        description: `Uploaded asset: ${opts.originalFilename}`,
        metadata: { assetId: asset.id, storageKey: opts.storageKey, mimeType: opts.mimeType },
      },
    });

    return { asset, idempotent: false };
  }

  async list(opts: {
    projectId: string;
    page?: number;
    limit?: number;
    mimePrefix?: string;
  }) {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 50, 100);
    const where = opts.mimePrefix
      ? { projectId: opts.projectId, mimeType: { startsWith: opts.mimePrefix } }
      : { projectId: opts.projectId };

    const [items, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async attachToRevision(opts: {
    contentRevisionId: string;
    assetId: string;
    position?: number;
    altText?: string;
    userId: string;
    projectId: string;
  }) {
    const [revision, asset] = await Promise.all([
      prisma.contentRevision.findUnique({
        where: { id: opts.contentRevisionId },
        include: { content: { select: { projectId: true } } },
      }),
      prisma.asset.findUnique({ where: { id: opts.assetId } }),
    ]);
    if (!revision) throw new AssetServiceError('Revision not found', 404);
    if (!asset) throw new AssetServiceError('Asset not found', 404);
    if (
      revision.content.projectId !== opts.projectId ||
      asset.projectId !== opts.projectId ||
      asset.projectId !== revision.content.projectId
    ) {
      throw new AssetServiceError('Asset and revision must belong to the active project', 403);
    }

    const link = await prisma.contentAsset.upsert({
      where: {
        contentRevisionId_assetId: {
          contentRevisionId: opts.contentRevisionId,
          assetId: opts.assetId,
        },
      },
      create: {
        contentRevisionId: opts.contentRevisionId,
        assetId: opts.assetId,
        position: opts.position ?? 0,
        altText: opts.altText,
      },
      update: {
        position: opts.position ?? 0,
        altText: opts.altText,
      },
      include: { asset: true },
    });

    return link;
  }
}

export const assetService = new AssetService();
