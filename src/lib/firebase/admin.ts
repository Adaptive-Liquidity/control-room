// src/lib/firebase/admin.ts
// Server-only Firebase Admin / GCS helpers for signed upload URLs.
import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'crypto';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
]);

export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
}

function resolveBucketName(): string | null {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.GCS_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    null
  );
}

export function isStorageConfigured(): boolean {
  const bucket = resolveBucketName();
  if (!bucket) return false;
  // Prefer explicit service account JSON, else ADC / GOOGLE_APPLICATION_CREDENTIALS
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  );
}

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0]!;
    return adminApp;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket: resolveBucketName() ?? undefined,
    });
  } else {
    adminApp = initializeApp({
      credential: applicationDefault(),
      projectId: projectId ?? undefined,
      storageBucket: resolveBucketName() ?? undefined,
    });
  }
  return adminApp;
}

function getBucket() {
  const name = resolveBucketName();
  if (!name) {
    throw new Error('Storage bucket is not configured');
  }
  return getStorage(getAdminApp()).bucket(name);
}

export function buildStorageKey(opts: {
  userId: string;
  originalFilename: string;
  mimeType: string;
}): string {
  const ext =
    opts.originalFilename.includes('.')
      ? opts.originalFilename.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
      : opts.mimeType.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
  const safeExt = ext.slice(0, 12) || 'bin';
  return `assets/${opts.userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${safeExt}`;
}

export async function createSignedUploadUrl(opts: {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; expiresAt: string }> {
  const bucket = getBucket();
  const file = bucket.file(opts.storageKey);
  const expiresMs = Date.now() + (opts.expiresInSeconds ?? 15 * 60) * 1000;

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresMs,
    contentType: opts.mimeType,
    // Note: GCS signed PUT does not enforce size in the signature itself;
    // size is validated again on /complete against object metadata.
  });

  return { uploadUrl, expiresAt: new Date(expiresMs).toISOString() };
}

export async function verifyObjectExists(opts: {
  storageKey: string;
  expectedMimeType?: string;
  maxBytes?: number;
}): Promise<{ sizeBytes: number; contentType: string | undefined; md5Hash: string | undefined }> {
  const bucket = getBucket();
  const file = bucket.file(opts.storageKey);
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error('Object not found in storage');
  }
  const [metadata] = await file.getMetadata();
  const sizeBytes = Number(metadata.size ?? 0);
  const contentType = metadata.contentType as string | undefined;
  const md5Hash = metadata.md5Hash as string | undefined;

  if (opts.maxBytes != null && sizeBytes > opts.maxBytes) {
    throw new Error(`Object exceeds max size of ${opts.maxBytes} bytes`);
  }
  if (
    opts.expectedMimeType &&
    contentType &&
    contentType.toLowerCase() !== opts.expectedMimeType.toLowerCase()
  ) {
    throw new Error('Object content-type mismatch');
  }

  return { sizeBytes, contentType, md5Hash };
}
