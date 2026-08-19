<script setup lang="ts">
import type {
  ActivitySummaryBusinessStage,
  ActivitySummaryProgressTrace,
} from '../activity-summary-progress';

import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
  trace: ActivitySummaryProgressTrace;
}>();

const emit = defineEmits<{
  refresh: [];
  retry: [];
  toggle: [];
}>();

const stages: Array<{ key: ActivitySummaryBusinessStage; label: string }> = [
  { key: 'COLLECTING', label: '汇总活动数据' },
  { key: 'PREPARING', label: '整理报告上下文' },
  { key: 'GENERATING', label: '等待 AI 完整响应' },
  { key: 'SAVING', label: '保存报告' },
];

const periodLabel = computed(
  () => ({ month: '本月', week: '本周', year: '本年' })[props.trace.period],
);

const statusIcon = computed(
  () =>
    ({
      completed: 'i-ant-design:check-circle-filled text-emerald-600',
      disconnected: 'i-ant-design:disconnect-outlined text-amber-600',
      empty: 'i-ant-design:info-circle-filled text-slate-500',
      failed: 'i-ant-design:close-circle-filled text-red-600',
      running: 'i-ant-design:loading-outlined animate-spin text-indigo-600',
    })[props.trace.status],
);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const totalElapsedMs = computed(() => {
  const end =
    props.trace.status === 'running'
      ? now.value
      : props.trace.completedAt || now.value;
  return Math.max(0, end - props.trace.startedAt);
});

const formatDuration = (durationMs: number) =>
  durationMs < 100 ? '<0.1s' : `${(durationMs / 1000).toFixed(1)}s`;

const totalElapsed = computed(() => formatDuration(totalElapsedMs.value));

const timingFor = (stage: ActivitySummaryBusinessStage) =>
  props.trace.stages.find((item) => item.stage === stage);

const stageState = (stage: ActivitySummaryBusinessStage) => {
  const timing = timingFor(stage);
  if (timing?.completedAt !== undefined) return 'completed';
  if (props.trace.status === 'completed') return 'completed';
  if (props.trace.stage === stage) return 'current';
  return 'waiting';
};

const stageElapsedMs = (stage: ActivitySummaryBusinessStage) => {
  const timing = timingFor(stage);
  if (!timing) return undefined;
  const end = timing.completedAt || props.trace.completedAt || now.value;
  return Math.max(0, end - timing.startedAt);
};

const stageElapsed = (stage: ActivitySummaryBusinessStage) => {
  const duration = stageElapsedMs(stage);
  return duration === undefined ? undefined : formatDuration(duration);
};

const stageShare = (stage: ActivitySummaryBusinessStage) => {
  const duration = stageElapsedMs(stage);
  if (duration === undefined || totalElapsedMs.value <= 0) return undefined;
  return (duration / totalElapsedMs.value) * 100;
};

const formatShare = (stage: ActivitySummaryBusinessStage) => {
  const share = stageShare(stage);
  if (share === undefined) return undefined;
  if (share > 0 && share < 1) return '<1%';
  return `${Math.round(share)}%`;
};

const stageBarWidth = (stage: ActivitySummaryBusinessStage) => {
  const share = stageShare(stage);
  if (share === undefined) return '0%';
  return `${Math.max(share, 0.8)}%`;
};

const longestStage = computed(
  () =>
    stages
      .map((stage) => ({
        ...stage,
        durationMs: stageElapsedMs(stage.key),
      }))
      .filter(
        (stage): stage is typeof stage & { durationMs: number } =>
          stage.durationMs !== undefined,
      )
      .sort((left, right) => right.durationMs - left.durationMs)[0],
);

const statusLabel = computed(() => {
  if (props.trace.status === 'completed') {
    return longestStage.value
      ? `已完成 · 主要耗时 ${longestStage.value.label} ${formatDuration(longestStage.value.durationMs)}`
      : '已完成';
  }
  if (props.trace.status === 'running') {
    return props.trace.stage === 'GENERATING'
      ? '等待 AI 完整响应'
      : props.trace.label || '正在生成';
  }
  return {
    disconnected: '连接中断',
    empty: '未生成报告',
    failed: '生成失败',
  }[props.trace.status];
});

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 100);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <section
    class="mx-auto w-full max-w-[720px] overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-slate-50 to-indigo-50/70 shadow-sm sm:rounded-[24px]"
    aria-live="polite"
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-3 text-left sm:px-6 sm:py-4"
      :aria-expanded="!trace.collapsed"
      @click="emit('toggle')"
    >
      <span :class="statusIcon" class="h-4 w-4 shrink-0"></span>
      <span class="shrink-0 font-medium text-slate-800">生成过程</span>
      <span class="text-slate-300">·</span>
      <span class="min-w-0 truncate text-sm text-slate-600">
        {{ statusLabel }}
      </span>
      <span class="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
        {{ periodLabel }} · {{ trace.status === 'completed' ? '总计 ' : ''
        }}{{ totalElapsed }}
      </span>
      <span
        class="i-ant-design:down-outlined h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': !trace.collapsed }"
      ></span>
    </button>

    <Transition name="progress-detail">
      <div
        v-if="!trace.collapsed"
        class="border-t border-indigo-100/80 px-4 pb-4 pt-4 sm:px-6 sm:pb-6"
      >
        <div class="space-y-3.5">
          <div
            v-for="item in stages"
            :key="item.key"
            class="space-y-1.5"
            :class="
              stageState(item.key) === 'waiting'
                ? 'text-slate-400'
                : 'text-slate-800'
            "
            :title="
              item.key === 'GENERATING'
                ? '包含模型服务排队、推理、生成及网络返回时间'
                : undefined
            "
          >
            <div class="flex min-h-6 items-center gap-2.5 text-sm sm:text-base">
              <span
                v-if="stageState(item.key) === 'completed'"
                class="i-ant-design:check-outlined w-4 shrink-0 text-emerald-600"
              ></span>
              <span
                v-else-if="stageState(item.key) === 'current'"
                class="h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-600 ring-4 ring-indigo-100"
              ></span>
              <span
                v-else
                class="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-400"
              ></span>
              <span
                :class="
                  stageState(item.key) === 'current' ? 'font-semibold' : ''
                "
              >
                {{ item.label }}
              </span>
              <span
                v-if="item.key === 'GENERATING'"
                class="i-ant-design:info-circle-outlined h-3.5 w-3.5 shrink-0 text-slate-400"
                aria-label="模型响应耗时说明"
              ></span>
              <span
                v-if="longestStage?.key === item.key"
                class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-700"
              >
                主要耗时
              </span>
              <span
                v-if="stageElapsed(item.key) !== undefined"
                class="ml-auto shrink-0 tabular-nums text-slate-500"
              >
                {{ stageElapsed(item.key) }}
              </span>
              <span
                v-if="formatShare(item.key) !== undefined"
                class="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400"
              >
                {{ formatShare(item.key) }}
              </span>
            </div>
            <div
              class="ml-7 h-1.5 overflow-hidden rounded-full bg-slate-200/80"
            >
              <div
                class="h-full rounded-full transition-[width] duration-300"
                :class="[
                  stageState(item.key) === 'current'
                    ? 'animate-pulse bg-gradient-to-r from-indigo-500 to-violet-500'
                    : longestStage?.key === item.key
                      ? 'bg-violet-500'
                      : 'bg-indigo-400',
                ]"
                :style="{ width: stageBarWidth(item.key) }"
              ></div>
            </div>
          </div>
        </div>

        <div
          v-if="trace.status === 'completed' && longestStage"
          class="mt-5 rounded-xl border border-violet-100 bg-white/70 px-3 py-2.5 text-sm text-slate-600"
        >
          主要耗时：{{ longestStage.label }}，占总耗时
          {{ formatShare(longestStage.key) }}。
        </div>

        <div
          v-if="trace.status === 'empty'"
          class="mt-5 rounded-xl border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-600"
        >
          当前周期没有可总结的活动，因此未生成报告。
        </div>

        <div
          v-if="trace.status === 'failed' || trace.status === 'disconnected'"
          class="mt-5 rounded-xl border px-3 py-3 text-sm"
          :class="
            trace.status === 'failed'
              ? 'border-red-100 bg-red-50 text-red-700'
              : 'border-amber-100 bg-amber-50 text-amber-800'
          "
        >
          <p>
            {{
              trace.status === 'disconnected'
                ? trace.errorMessage || '连接已中断，报告可能仍在后台继续生成。'
                : trace.errorMessage || '活动报告生成失败。'
            }}
          </p>
          <button
            v-if="trace.status === 'failed' && trace.retryable"
            type="button"
            class="mt-2 font-medium underline underline-offset-2"
            @click="emit('retry')"
          >
            重试
          </button>
          <button
            v-else-if="trace.status === 'disconnected'"
            type="button"
            class="mt-2 font-medium underline underline-offset-2"
            @click="emit('refresh')"
          >
            刷新会话
          </button>
        </div>

        <div
          v-if="trace.status !== 'completed' && trace.status !== 'empty'"
          class="mt-6 border-t border-slate-200/80 pt-4"
        >
          <div
            class="mb-2 flex items-center justify-between text-xs text-slate-500"
          >
            <span>整体进度（辅助）</span>
            <span class="tabular-nums">{{ trace.percent }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-300"
              :style="{ width: `${trace.percent}%` }"
            ></div>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.progress-detail-enter-active,
.progress-detail-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.progress-detail-enter-from,
.progress-detail-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
