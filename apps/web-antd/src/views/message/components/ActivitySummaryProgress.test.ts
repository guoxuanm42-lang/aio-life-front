import { mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyActivitySummaryProgress,
  completeActivitySummaryTrace,
  createActivitySummaryTrace,
  terminateActivitySummaryTrace,
} from '../activity-summary-progress';
import ActivitySummaryProgress from './ActivitySummaryProgress.vue';

afterEach(() => {
  vi.useRealTimers();
});

describe('activitySummaryProgress', () => {
  it('supports folding while keeping the real stage and total elapsed visible', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-08-16T08:00:00.000Z').getTime();
    vi.setSystemTime(new Date('2026-08-16T08:00:18.400Z'));
    let trace = createActivitySummaryTrace({
      conversationId: 'conversation-1',
      idempotencyKey: 'request-1',
      period: 'year',
      startedAt,
    });
    trace = applyActivitySummaryProgress(
      trace,
      { label: '正在汇总', percent: 15, stage: 'COLLECTING' },
      startedAt,
    );
    trace = applyActivitySummaryProgress(
      trace,
      { label: 'AI 正在生成复盘', percent: 55, stage: 'GENERATING' },
      startedAt + 5000,
    );

    const wrapper = mount(ActivitySummaryProgress, { props: { trace } });
    vi.advanceTimersByTime(100);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('等待 AI 完整响应');
    expect(wrapper.text()).toContain('本年 · 18.5s');
    expect(wrapper.text()).toContain('整体进度（辅助）');
    await wrapper.get('button[aria-expanded="true"]').trigger('click');
    expect(wrapper.emitted('toggle')).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders a completed trace collapsed and expands its observed stages', async () => {
    const startedAt = new Date('2026-08-16T08:00:00.000Z').getTime();
    let trace = createActivitySummaryTrace({
      conversationId: 'conversation-1',
      idempotencyKey: 'request-1',
      period: 'month',
      startedAt,
    });
    trace = applyActivitySummaryProgress(
      trace,
      { label: '正在汇总', percent: 15, stage: 'COLLECTING' },
      startedAt,
    );
    trace = applyActivitySummaryProgress(
      trace,
      { label: '正在整理上下文', percent: 40, stage: 'PREPARING' },
      startedAt + 200,
    );
    trace = applyActivitySummaryProgress(
      trace,
      { label: 'AI 正在生成复盘', percent: 55, stage: 'GENERATING' },
      startedAt + 300,
    );
    trace = applyActivitySummaryProgress(
      trace,
      { label: '正在保存', percent: 90, stage: 'SAVING' },
      startedAt + 10_300,
    );
    trace = completeActivitySummaryTrace(
      trace,
      {
        assistantMessageId: 'assistant-1',
        content: '报告',
        conversationId: 'conversation-1',
        period: 'month',
        userMessage: '请求',
        userMessageId: 'user-1',
      },
      startedAt + 10_400,
    );
    const wrapper = mount(ActivitySummaryProgress, { props: { trace } });

    expect(wrapper.text()).toContain('生成过程');
    expect(wrapper.text()).toContain('已完成');
    expect(wrapper.text()).toContain('主要耗时 等待 AI 完整响应 10.0s');
    expect(wrapper.text()).toContain('本月 · 总计 10.4s');
    expect(wrapper.find('[aria-expanded="false"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('整体进度（辅助）');

    await wrapper.setProps({ trace: { ...trace, collapsed: false } });
    expect(wrapper.text()).toContain('汇总活动数据');
    expect(wrapper.text()).toContain('主要耗时：等待 AI 完整响应');
    expect(wrapper.text()).toContain('96%');
    expect(wrapper.text()).not.toContain('整体进度（辅助）');
    expect(
      wrapper.find('[title*="模型服务排队、推理、生成及网络返回"]').exists(),
    ).toBe(true);
    wrapper.unmount();
  });

  it('keeps disconnect details expanded and offers refresh', async () => {
    const trace = terminateActivitySummaryTrace(
      createActivitySummaryTrace({
        conversationId: 'conversation-1',
        idempotencyKey: 'request-1',
        period: 'week',
      }),
      {
        errorMessage: '连接已断开，后台可能继续生成',
        status: 'disconnected',
      },
    );
    const wrapper = mount(ActivitySummaryProgress, { props: { trace } });

    expect(wrapper.text()).toContain('后台可能继续生成');
    await wrapper.findAll('button').at(-1)?.trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
    expect(wrapper.emitted('retry')).toBeUndefined();
    wrapper.unmount();
  });
});
