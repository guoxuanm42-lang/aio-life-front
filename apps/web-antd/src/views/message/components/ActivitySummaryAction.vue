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

const options: Array<{
  description: string;
  label: string;
  period: ActivitySummaryPeriod;
}> = [
  { period: 'week', label: '本周复盘', description: '本周一至现在' },
  { period: 'month', label: '本月总结', description: '本月一日至现在' },
  { period: 'year', label: '本年回顾', description: '本年一月一日至现在' },
];

const selectedOption = computed(
  () => options.find((option) => option.period === props.period) ?? options[0]!,
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
        <Menu class="min-w-56">
          <MenuItem
            v-for="option in options"
            :key="option.period"
            @click="selectPeriod(option.period)"
          >
            <div class="flex items-center gap-3 py-0.5">
              <span class="w-4 text-indigo-500">
                {{ option.period === period ? '✓' : '' }}
              </span>
              <div>
                <div class="font-medium text-gray-800">{{ option.label }}</div>
                <div class="text-xs text-gray-400">
                  {{ option.description }}
                </div>
              </div>
            </div>
          </MenuItem>
        </Menu>
      </template>
    </Dropdown>
  </div>
</template>
