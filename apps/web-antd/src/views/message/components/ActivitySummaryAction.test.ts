import { mount } from '@vue/test-utils';

import { describe, expect, it } from 'vitest';

import ActivitySummaryAction from './ActivitySummaryAction.vue';

describe('activity summary action', () => {
  it('shows the selected period and emits generate once', async () => {
    const wrapper = mount(ActivitySummaryAction, {
      props: { period: 'month' },
      global: { stubs: { Dropdown: true } },
    });

    expect(wrapper.text()).toContain('生成本月总结');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('generate')).toHaveLength(1);
  });

  it('uses compact mobile loading text and disables generation', () => {
    const wrapper = mount(ActivitySummaryAction, {
      props: { loading: true, mobile: true, period: 'year' },
      global: { stubs: { Dropdown: true } },
    });

    expect(wrapper.text()).toContain('生成中…');
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });
});
