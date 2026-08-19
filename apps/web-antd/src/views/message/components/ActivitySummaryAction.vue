<script setup lang="ts">
import type { ActivitySummaryPeriod } from '#/api/core/llm';

import { computed } from 'vue';

import { Dropdown, Menu, MenuItem } from 'ant-design-vue';

const props = defineProps<{
  disabled?: boolean;
  loading?: boolean;
  mobile?: boolean;
  period: ActivitySummaryPeriod;
  retry?: boolean;
}>();

const emit = defineEmits<{
  generate: [];
  select: [period: ActivitySummaryPeriod];
}>();

const formatMenuDate = (date: Date) =>
  `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

const options = computed<
  Array<{
    description: string;
    label: string;
    period: ActivitySummaryPeriod;
  }>
>(() => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const end = formatMenuDate(now);
  return [
    {
      period: 'week',
      label: '本周复盘',
      description: `${formatMenuDate(weekStart)} — ${end}`,
    },
    {
      period: 'month',
      label: '本月总结',
      description: `${formatMenuDate(monthStart)} — ${end}`,
    },
    {
      period: 'year',
      label: '本年回顾',
      description: `${formatMenuDate(yearStart)} — ${end}`,
    },
  ];
});

const selectedOption = computed(
  () =>
    options.value.find((option) => option.period === props.period) ??
    options.value[0]!,
);

const buttonLabel = computed(() => {
  if (props.loading) {
    return props.mobile ? '生成中…' : `正在生成${selectedOption.value.label}…`;
  }
  if (props.mobile) {
    return props.retry ? '重试总结' : '总结';
  }
  return `${props.retry ? '重试' : '生成'}${selectedOption.value.label}`;
});

const selectPeriod = (period: ActivitySummaryPeriod) => {
  emit('select', period);
};
</script>

<template>
  <div class="inline-flex h-8 overflow-hidden rounded-lg shadow-sm">
    <button
      type="button"
      class="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 px-3 text-sm font-medium text-white transition hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="disabled || loading"
      :title="buttonLabel"
      @click="emit('generate')"
    >
      <span
        v-if="loading"
        class="i-ant-design:loading-3-quarters-outlined animate-spin"
      ></span>
      <span v-else>✨</span>
      <span>{{ buttonLabel }}</span>
    </button>

    <Dropdown :disabled="disabled || loading" :trigger="['click']">
      <button
        type="button"
        class="flex w-8 items-center justify-center border-l border-white/25 bg-violet-500 text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="disabled || loading"
        aria-label="选择活动总结周期"
      >
        <span class="i-ant-design:down-outlined text-xs"></span>
      </button>
      <template #overlay>
        <Menu
          :selected-keys="[period]"
          class="w-[260px] rounded-xl p-1.5 shadow-xl"
        >
          <MenuItem
            v-for="option in options"
            :key="option.period"
            class="!mb-1 !h-auto !rounded-lg !px-3 !py-2 last:!mb-0"
            @click="selectPeriod(option.period)"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="font-medium text-gray-800">{{ option.label }}</div>
                <div class="mt-0.5 text-xs text-gray-400">
                  {{ option.description }}
                </div>
              </div>
              <span
                v-if="option.period === period"
                class="i-ant-design:check-outlined shrink-0 text-base text-indigo-500"
              ></span>
            </div>
          </MenuItem>
        </Menu>
      </template>
    </Dropdown>
  </div>
</template>
