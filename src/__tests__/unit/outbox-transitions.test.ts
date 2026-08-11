import {
  OUTBOX_BACKOFF_MS,
  outboxBackoffMs,
} from '@/lib/outbox/outbox.service';
import type { ApprovalDecision } from '@/services/approval.service';

/** Contract: human decisions never set PUBLISHED — only publish receipt does. */
function contentStatusFromDecision(decision: ApprovalDecision): string {
  if (decision === 'APPROVED') return 'APPROVED';
  if (decision === 'REJECTED') return 'REJECTED';
  return 'REVISION_REQUESTED';
}

describe('outbox backoff', () => {
  it('schedules RETRY delays for attempts 1..length-1', () => {
    expect(outboxBackoffMs(1)).toBe(15_000);
    expect(outboxBackoffMs(2)).toBe(60_000);
    expect(outboxBackoffMs(3)).toBe(5 * 60_000);
    expect(outboxBackoffMs(4)).toBe(15 * 60_000);
    expect(outboxBackoffMs(5)).toBe(60 * 60_000);
  });

  it('returns null (FAILED) after exhausting backoff table', () => {
    expect(outboxBackoffMs(OUTBOX_BACKOFF_MS.length)).toBeNull();
    expect(outboxBackoffMs(OUTBOX_BACKOFF_MS.length + 1)).toBeNull();
  });
});

describe('content state transitions', () => {
  it('maps approval decisions to content statuses', () => {
    expect(contentStatusFromDecision('APPROVED')).toBe('APPROVED');
    expect(contentStatusFromDecision('REJECTED')).toBe('REJECTED');
    expect(contentStatusFromDecision('REVISION_REQUESTED')).toBe(
      'REVISION_REQUESTED'
    );
  });

  it('never maps human decisions to PUBLISHED', () => {
    const decisions: ApprovalDecision[] = [
      'APPROVED',
      'REJECTED',
      'REVISION_REQUESTED',
    ];
    for (const d of decisions) {
      expect(contentStatusFromDecision(d)).not.toBe('PUBLISHED');
    }
  });
});
