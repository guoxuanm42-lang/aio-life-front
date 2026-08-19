import type { ActivitySummaryContext } from '#/api/core/llm';

import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import ActivitySummaryReport from './ActivitySummaryReport.vue';

const summary: ActivitySummaryContext = {
  period: 'year',
  startTime: '2026-01-01T00:00:00',
  endTime: '2026-08-15T12:00:00',
  timeRecord: {
    recordCount: 3,
    totalMinutes: 125,
    categoryDurations: [
      {
        categoryName: '学习',
        durationMinutes: 125,
        percentage: 100,
      },
    ],
    mainActivities: [],
  },
  thought: {
    newCount: 8,
    themeDistribution: [{ name: '生活', count: 5 }],
    typeDistribution: [],
    titles: ['测试闪念'],
  },
};

const mountReport = () =>
  mount(ActivitySummaryReport, {
    props: { content: '## 核心总结\n保持积累。', summary },
    global: { stubs: { ActivitySummaryChart: true } },
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('activity summary report', () => {
  it('renders report identity, metrics, charts and details', () => {
    const wrapper = mountReport();

    expect(wrapper.text()).toContain('2026 年度活动复盘');
    expect(wrapper.text()).toContain('2026.01.01 — 2026.08.15');
    expect(wrapper.text()).toContain('2 小时 5 分钟');
    expect(wrapper.text()).toContain('想法沉淀');
    expect(
      wrapper.findAllComponents({ name: 'ActivitySummaryChart' }),
    ).toHaveLength(2);
    expect(wrapper.text()).toContain('AI 复盘解读');
  });

  it('emits the report period when regenerating', async () => {
    const wrapper = mountReport();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('重新生成'));

    await button?.trigger('click');

    expect(wrapper.emitted('regenerate')).toEqual([['year']]);
  });

  it('falls back to the legacy copy command in insecure contexts', async () => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false,
    });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    const wrapper = mountReport();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('复制报告'));

    await button?.trigger('click');
    await flushPromises();

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses the clipboard API in secure contexts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const wrapper = mountReport();
    const button = wrapper
      .findAll('button')
      .find((item) => item.text().includes('复制报告'));

    await button?.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain('2026 年度活动复盘');
  });
});
