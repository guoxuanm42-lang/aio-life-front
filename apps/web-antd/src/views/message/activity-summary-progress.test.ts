import { describe, expect, it } from 'vitest';

import {
  applyActivitySummaryProgress,
  completeActivitySummaryTrace,
  createActivitySummaryTrace,
  persistActivitySummaryTraces,
  removeConversationSummaryTraces,
  restoreActivitySummaryTraces,
} from './activity-summary-progress';

describe('activity summary progress traces', () => {
  it('records observed stage durations and binds completion to the report', () => {
    let trace = createActivitySummaryTrace({
      conversationId: 'conversation-1',
      idempotencyKey: 'request-1',
      period: 'year',
      startedAt: 1000,
    });
    trace = applyActivitySummaryProgress(
      trace,
      { label: '汇总活动数据', percent: 15, stage: 'COLLECTING' },
      1000,
    );
    trace = applyActivitySummaryProgress(
      trace,
      { label: '整理报告上下文', percent: 40, stage: 'PREPARING' },
      2500,
    );
    trace = completeActivitySummaryTrace(
      trace,
      {
        assistantMessageId: 'assistant-1',
        content: '报告',
        conversationId: 'conversation-1',
        period: 'year',
        userMessage: '请求',
        userMessageId: 'user-1',
      },
      5000,
    );

    expect(trace.status).toBe('completed');
    expect(trace.collapsed).toBe(true);
    expect(trace.assistantMessageId).toBe('assistant-1');
    expect(trace.stages[0]?.completedAt).toBe(2500);
    expect(trace.stages[1]?.completedAt).toBe(5000);
  });

  it('restores a running trace as disconnected without inventing progress', () => {
    const storage = new StorageStub();
    const running = createActivitySummaryTrace({
      conversationId: 'conversation-1',
      idempotencyKey: 'request-1',
      period: 'week',
      startedAt: 1000,
    });
    persistActivitySummaryTraces('user-1', [running], storage);

    const restored = restoreActivitySummaryTraces('user-1', storage);

    expect(restored).toHaveLength(1);
    expect(restored[0]?.status).toBe('disconnected');
    expect(restored[0]?.percent).toBe(0);
    expect(restored[0]?.collapsed).toBe(false);
  });

  it('removes only traces belonging to the deleted conversation', () => {
    const first = createActivitySummaryTrace({
      conversationId: 'conversation-1',
      idempotencyKey: 'request-1',
      period: 'week',
    });
    const second = createActivitySummaryTrace({
      conversationId: 'conversation-2',
      idempotencyKey: 'request-2',
      period: 'month',
    });

    expect(
      removeConversationSummaryTraces([first, second], 'conversation-1'),
    ).toEqual([second]);
  });
});

class StorageStub implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
