<script setup lang="ts">
import type {
  ActivitySummaryContext,
  ActivitySummaryCountItem,
  ActivitySummaryPeriod,
} from '#/api/core/llm';
import type { ActivitySummaryChartSpec } from './ActivitySummaryChart.vue';

import { computed, ref } from 'vue';

import { message } from 'ant-design-vue';

import { renderSafeMarkdown } from '#/utils/safe-markdown';

import ActivitySummaryChart from './ActivitySummaryChart.vue';

interface DetailCard {
  icon: string;
  id: string;
  items: string[];
  summary: string;
  title: string;
}

interface MetricCard {
  helper: string;
  icon: string;
  label: string;
  value: string;
}

const props = defineProps<{
  content: string;
  loading?: boolean;
  summary: ActivitySummaryContext;
}>();

const emit = defineEmits<{
  regenerate: [period: ActivitySummaryPeriod];
}>();

const expandedCards = ref<Set<string>>(new Set());

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString('zh-CN');
const formatDate = (value: string) =>
  (value?.slice(0, 10) || '').replaceAll('-', '.');
const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${formatNumber(minutes)} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0
    ? `${formatNumber(hours)} 小时 ${rest} 分钟`
    : `${formatNumber(hours)} 小时`;
};

const reportTitle = computed(() => {
  const year = props.summary.startTime?.slice(0, 4);
  if (props.summary.period === 'year') return `${year} 年度活动复盘`;
  if (props.summary.period === 'month') return `${year} 年本月活动总结`;
  return `${year} 年本周活动复盘`;
});

const dateRange = computed(
  () =>
    `${formatDate(props.summary.startTime)} — ${formatDate(props.summary.endTime)}`,
);

const metrics = computed<MetricCard[]>(() => {
  const summary = props.summary;
  const cards: MetricCard[] = [];
  if (summary.timeRecord) {
    cards.push({
      helper: `${formatNumber(summary.timeRecord.recordCount)} 条记录`,
      icon: 'i-ant-design:clock-circle-outlined',
      label: '时迹投入',
      value: formatMinutes(summary.timeRecord.totalMinutes),
    });
  }
  if (summary.thought) {
    cards.push({
      helper: '新增闪念',
      icon: 'i-ant-design:bulb-outlined',
      label: '想法沉淀',
      value: `${formatNumber(summary.thought.newCount)} 条`,
    });
  }
  if (summary.todo) {
    cards.push({
      helper: '周期内新增',
      icon: 'i-ant-design:check-square-outlined',
      label: '待办事项',
      value: `${formatNumber(summary.todo.newCount)} 项`,
    });
  }
  if (summary.article) {
    cards.push({
      helper: `${formatNumber(summary.article.newCount)} 新增 · ${formatNumber(summary.article.updatedCount)} 更新`,
      icon: 'i-ant-design:file-text-outlined',
      label: '文章沉淀',
      value: `${formatNumber(summary.article.newCount + summary.article.updatedCount)} 篇`,
    });
  }
  if (summary.note) {
    cards.push({
      helper: '新增笔记',
      icon: 'i-ant-design:book-outlined',
      label: '笔记记录',
      value: `${formatNumber(summary.note.newCount)} 篇`,
    });
  }
  if (summary.problem) {
    cards.push({
      helper: '新增题目',
      icon: 'i-ant-design:question-circle-outlined',
      label: '题目积累',
      value: `${formatNumber(summary.problem.newCount)} 道`,
    });
  }
  if (summary.food) {
    cards.push({
      helper: '新增美食记录',
      icon: 'i-ant-design:coffee-outlined',
      label: '美食发现',
      value: `${formatNumber(summary.food.newCount)} 条`,
    });
  }
  if (summary.album) {
    cards.push({
      helper: '新建相册',
      icon: 'i-ant-design:picture-outlined',
      label: '相册整理',
      value: `${formatNumber(summary.album.newFolderCount)} 个`,
    });
  }
  if (summary.mcp) {
    cards.push({
      helper: `${formatNumber(summary.mcp.successCalls)} 成功 · ${formatNumber(summary.mcp.failedCalls)} 失败`,
      icon: 'i-ant-design:api-outlined',
      label: 'MCP 调用',
      value: `${formatNumber(summary.mcp.totalCalls)} 次`,
    });
  }
  return cards.slice(0, 4);
});

const toChartData = (items: ActivitySummaryCountItem[] = []) =>
  items
    .filter((item) => item.count > 0)
    .map((item) => ({ name: item.name, value: item.count }));

const chartSpecs = computed<ActivitySummaryChartSpec[]>(() => {
  const summary = props.summary;
  const candidates: ActivitySummaryChartSpec[] = [];
  const categories = (summary.timeRecord?.categoryDurations ?? [])
    .filter((item) => item.durationMinutes > 0)
    .map((item) => ({ name: item.categoryName, value: item.durationMinutes }));
  if (categories.length > 0) {
    candidates.push({
      data: categories,
      kind: 'pie',
      title: '时间分类分布',
      unit: '分钟',
    });
  }
  const distributions: Array<[string, ActivitySummaryCountItem[] | undefined]> =
    [
      ['闪念主题分布', summary.thought?.themeDistribution],
      ['闪念类型分布', summary.thought?.typeDistribution],
      ['文章分类分布', summary.article?.categoryDistribution],
      ['题目分类分布', summary.problem?.categoryDistribution],
      ['题目难度分布', summary.problem?.difficultyDistribution],
    ];
  for (const [title, items] of distributions) {
    const data = toChartData(items);
    if (data.length > 0) {
      candidates.push({ data, kind: 'bar', title, unit: '条' });
    }
  }
  return candidates.slice(0, 2);
});

const names = (items: string[] | undefined) => (items ?? []).filter(Boolean);
const countLines = (items: ActivitySummaryCountItem[] | undefined) =>
  (items ?? []).map((item) => `${item.name}：${formatNumber(item.count)} 条`);

const detailCards = computed<DetailCard[]>(() => {
  const summary = props.summary;
  const cards: DetailCard[] = [];
  if (summary.timeRecord) {
    cards.push({
      icon: 'i-ant-design:clock-circle-outlined',
      id: 'time-record',
      items: [
        ...summary.timeRecord.categoryDurations.map(
          (item) =>
            `${item.categoryName}：${formatMinutes(item.durationMinutes)}`,
        ),
        ...summary.timeRecord.mainActivities.map(
          (item) =>
            `${item.title} · ${formatDate(item.date)} · ${formatMinutes(item.durationMinutes)}`,
        ),
      ],
      summary: `${formatNumber(summary.timeRecord.recordCount)} 条记录，共 ${formatMinutes(summary.timeRecord.totalMinutes)}`,
      title: '时间记录',
    });
  }
  if (summary.thought) {
    cards.push({
      icon: 'i-ant-design:bulb-outlined',
      id: 'thought',
      items: [
        ...countLines(summary.thought.themeDistribution),
        ...names(summary.thought.titles),
      ],
      summary: `新增 ${formatNumber(summary.thought.newCount)} 条闪念`,
      title: '想法沉淀',
    });
  }
  if (summary.todo) {
    cards.push({
      icon: 'i-ant-design:check-square-outlined',
      id: 'todo',
      items: names(summary.todo.contents),
      summary: `新增 ${formatNumber(summary.todo.newCount)} 项待办`,
      title: '待办事项',
    });
  }
  if (summary.article) {
    cards.push({
      icon: 'i-ant-design:file-text-outlined',
      id: 'article',
      items: [
        ...names(summary.article.newTitles),
        ...names(summary.article.updatedTitles),
      ],
      summary: `新增 ${formatNumber(summary.article.newCount)} 篇，更新 ${formatNumber(summary.article.updatedCount)} 篇`,
      title: '文章沉淀',
    });
  }
  if (summary.note) {
    cards.push({
      icon: 'i-ant-design:book-outlined',
      id: 'note',
      items: names(summary.note.titles),
      summary: `新增 ${formatNumber(summary.note.newCount)} 篇笔记`,
      title: '笔记记录',
    });
  }
  if (summary.problem) {
    cards.push({
      icon: 'i-ant-design:question-circle-outlined',
      id: 'problem',
      items: [
        ...countLines(summary.problem.difficultyDistribution),
        ...names(summary.problem.titles),
      ],
      summary: `新增 ${formatNumber(summary.problem.newCount)} 道题目`,
      title: '题目积累',
    });
  }
  if (summary.food) {
    cards.push({
      icon: 'i-ant-design:coffee-outlined',
      id: 'food',
      items: names(summary.food.dishNames),
      summary: `新增 ${formatNumber(summary.food.newCount)} 条美食记录`,
      title: '美食发现',
    });
  }
  if (summary.album) {
    cards.push({
      icon: 'i-ant-design:picture-outlined',
      id: 'album',
      items: names(summary.album.folderNames),
      summary: `新建 ${formatNumber(summary.album.newFolderCount)} 个相册`,
      title: '相册整理',
    });
  }
  if (summary.mcp) {
    cards.push({
      icon: 'i-ant-design:api-outlined',
      id: 'mcp',
      items: summary.mcp.toolRanking.map(
        (item) =>
          `${item.toolName}：${formatNumber(item.callCount)} 次，平均 ${formatNumber(item.averageDurationMs)} ms`,
      ),
      summary: `${formatNumber(summary.mcp.totalCalls)} 次调用，成功 ${formatNumber(summary.mcp.successCalls)} 次`,
      title: 'MCP 工具调用',
    });
  }
  return cards;
});

const renderedMarkdown = computed(() => renderSafeMarkdown(props.content));

const toggleCard = (id: string) => {
  const next = new Set(expandedCards.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expandedCards.value = next;
};

const copyFallback = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy command failed');
};

const copyReport = async () => {
  const metricText = metrics.value
    .map((item) => `${item.label}：${item.value}（${item.helper}）`)
    .join('\n');
  const text = `${reportTitle.value}\n${dateRange.value}\n\n${metricText}\n\n${props.content}`;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      copyFallback(text);
    }
    message.success('报告已复制');
  } catch {
    message.error('复制失败，请手动选择报告内容');
  }
};
</script>

<template>
  <article
    class="activity-report mx-auto w-full max-w-[1080px] overflow-hidden rounded-3xl border border-indigo-100 bg-indigo-50/40 shadow-sm"
  >
    <header
      class="report-cover relative overflow-hidden px-5 py-6 sm:px-8 sm:py-8"
    >
      <div
        class="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <div
            class="mb-3 inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm backdrop-blur"
          >
            <span class="i-ant-design:line-chart-outlined"></span>
            AIO-LIFE 活动报告
          </div>
          <h2
            class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            {{ reportTitle }}
          </h2>
          <p class="mt-2 text-sm font-medium text-slate-500">{{ dateRange }}</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <button class="report-action" type="button" @click="copyReport">
            <span class="i-ant-design:copy-outlined"></span>复制报告
          </button>
          <button
            class="report-action report-action-primary"
            type="button"
            :disabled="loading"
            @click="emit('regenerate', summary.period)"
          >
            <span
              :class="
                loading
                  ? 'i-ant-design:loading-3-quarters-outlined animate-spin'
                  : 'i-ant-design:reload-outlined'
              "
            ></span>
            {{ loading ? '生成中…' : '重新生成' }}
          </button>
        </div>
      </div>
    </header>

    <div class="space-y-5 p-4 sm:p-6">
      <section
        v-if="metrics.length"
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="rounded-2xl border border-white bg-white p-4 shadow-sm"
        >
          <div
            class="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-lg text-indigo-600"
          >
            <span :class="metric.icon"></span>
          </div>
          <p class="text-xs font-medium text-slate-400">{{ metric.label }}</p>
          <p class="mt-1 text-xl font-bold text-slate-800">
            {{ metric.value }}
          </p>
          <p class="mt-1 truncate text-xs text-slate-400">
            {{ metric.helper }}
          </p>
        </div>
      </section>

      <section
        v-if="chartSpecs.length"
        class="grid grid-cols-1 gap-4 lg:grid-cols-2"
      >
        <ActivitySummaryChart
          v-for="chart in chartSpecs"
          :key="chart.title"
          :spec="chart"
        />
      </section>

      <section v-if="detailCards.length">
        <div class="mb-3 flex items-center gap-2">
          <span class="h-5 w-1 rounded-full bg-indigo-500"></span>
          <h3 class="font-semibold text-slate-800">活动明细</h3>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section
            v-for="card in detailCards"
            :key="card.id"
            class="rounded-2xl border border-indigo-100 bg-white p-4"
          >
            <div class="flex items-start gap-3">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
              >
                <span :class="card.icon"></span>
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="font-semibold text-slate-800">{{ card.title }}</h4>
                <p class="mt-1 text-sm text-slate-500">{{ card.summary }}</p>
              </div>
            </div>
            <ul
              v-if="card.items.length"
              class="mt-3 space-y-2 border-t border-slate-100 pt-3"
            >
              <li
                v-for="(item, index) in expandedCards.has(card.id)
                  ? card.items
                  : card.items.slice(0, 4)"
                :key="`${card.id}-${index}`"
                class="flex gap-2 text-sm leading-5 text-slate-600"
              >
                <span
                  class="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-300"
                ></span
                ><span class="break-all">{{ item }}</span>
              </li>
            </ul>
            <button
              v-if="card.items.length > 4"
              class="mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              type="button"
              @click="toggleCard(card.id)"
            >
              {{
                expandedCards.has(card.id)
                  ? '收起'
                  : `查看全部 ${card.items.length} 项`
              }}
            </button>
          </section>
        </div>
      </section>

      <section class="rounded-2xl border border-indigo-100 bg-white p-5 sm:p-6">
        <div class="mb-4 flex items-center gap-2">
          <span
            class="i-ant-design:bulb-outlined text-lg text-violet-500"
          ></span>
          <h3 class="font-semibold text-slate-800">AI 复盘解读</h3>
        </div>
        <!-- AI Markdown is sanitized by renderSafeMarkdown before v-html rendering. -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div
          class="report-markdown prose prose-sm max-w-none"
          v-html="renderedMarkdown"
        ></div>
      </section>
    </div>
  </article>
</template>

<style scoped>
.report-cover {
  background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 52%, #eff6ff 100%);
}
.report-cover::after {
  position: absolute;
  right: -4rem;
  top: -6rem;
  width: 18rem;
  height: 18rem;
  content: '';
  background: rgb(139 92 246 / 10%);
  border-radius: 9999px;
  filter: blur(2px);
}
.report-action {
  display: inline-flex;
  height: 2.25rem;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid rgb(199 210 254);
  border-radius: 0.75rem;
  padding: 0 0.75rem;
  color: #4f46e5;
  background: rgb(255 255 255 / 75%);
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.2s;
}
.report-action:hover {
  background: #fff;
  box-shadow: 0 4px 12px rgb(79 70 229 / 10%);
}
.report-action-primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
}
.report-action-primary:hover {
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
}
.report-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.report-markdown :deep(h1) {
  display: none;
}
.report-markdown :deep(h2) {
  margin: 1.25rem 0 0.5rem;
  color: #1e293b;
  font-size: 1.05rem;
  font-weight: 700;
}
.report-markdown :deep(h2:first-child) {
  margin-top: 0;
}
.report-markdown :deep(h3) {
  color: #334155;
  font-size: 0.95rem;
}
.report-markdown :deep(p),
.report-markdown :deep(li) {
  color: #475569;
  line-height: 1.8;
}
.report-markdown :deep(ul),
.report-markdown :deep(ol) {
  padding-left: 1.25rem;
}
.report-markdown :deep(blockquote) {
  margin: 1rem 0;
  border-left: 3px solid #818cf8;
  border-radius: 0 0.75rem 0.75rem 0;
  padding: 0.75rem 1rem;
  color: #475569;
  background: #eef2ff;
}
@media (max-width: 639px) {
  .activity-report {
    border-radius: 1rem;
  }
  .report-action {
    flex: 1;
    justify-content: center;
  }
}
</style>
