/**
 * Frozen n8n v1 contract lock — do not edit fixtures to make a breaking change pass.
 * Additive optional fields on schemas are allowed; removing/renaming/requiring fields is not.
 */
import fs from 'fs';
import path from 'path';
import {
  n8nAgentRunIngressSchema,
  n8nAttributionIngressSchema,
  n8nDraftIngressSchema,
  n8nMetricSnapshotSchema,
  n8nPolicyCheckSchema,
  n8nPublishReceiptSchema,
  n8nResumePayloadSchema,
} from '@/lib/n8n/contracts';

const FIXTURE_DIR = path.join(__dirname, '../fixtures/n8n/v1');

function loadFixture(name: string): unknown {
  const raw = fs
    .readFileSync(path.join(FIXTURE_DIR, name), 'utf8')
    .replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

describe('n8n v1 contract lock', () => {
  it('parses draft ingress fixture', () => {
    expect(n8nDraftIngressSchema.parse(loadFixture('draft.json'))).toMatchObject({
      schemaVersion: '1',
      eventId: 'evt-draft-v1-fixture',
    });
  });

  it('parses policy-check fixtures (scoped and unscoped)', () => {
    expect(n8nPolicyCheckSchema.parse(loadFixture('policy-check.json'))).toMatchObject({
      schemaVersion: '1',
      campaignId: 'cmp_fixture',
    });
    expect(n8nPolicyCheckSchema.parse(loadFixture('policy-check-unscoped.json'))).toEqual({
      schemaVersion: '1',
    });
  });

  it('parses agent-run ingress fixture', () => {
    expect(n8nAgentRunIngressSchema.parse(loadFixture('agent-run.json'))).toMatchObject({
      schemaVersion: '1',
      status: 'SUCCESS',
    });
  });

  it('parses publish-receipt fixture', () => {
    expect(n8nPublishReceiptSchema.parse(loadFixture('publish-receipt.json'))).toMatchObject({
      schemaVersion: '1',
      status: 'SUCCESS',
    });
  });

  it('parses metric-snapshot fixture', () => {
    expect(n8nMetricSnapshotSchema.parse(loadFixture('metric-snapshot.json'))).toMatchObject({
      schemaVersion: '1',
      impressions: 1000,
    });
  });

  it('parses attribution fixture', () => {
    expect(n8nAttributionIngressSchema.parse(loadFixture('attribution.json'))).toMatchObject({
      schemaVersion: '1',
      kind: 'CLICK',
    });
  });

  it('parses resume payload fixture with literal schemaVersion 1', () => {
    expect(n8nResumePayloadSchema.parse(loadFixture('resume.json'))).toMatchObject({
      schemaVersion: '1',
      decision: 'APPROVED',
    });
  });
});
