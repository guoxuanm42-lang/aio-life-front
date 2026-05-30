<script lang="ts" setup>
import type { Task, TaskQueryParams, TaskType } from '#/api/core/todo';

import { computed, onMounted, ref } from 'vue';

import { EditOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import {
  Button as AButton,
  Empty as AEmpty,
  Modal as AModal,
  RangePicker as ARangePicker,
  Select as ASelect,
  SelectOption as ASelectOption,
  Tag as ATag,
  Textarea as ATextarea,
  message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';

import { getTaskList, getTaskTypeList, updateTask } from '#/api/core/todo';

type FailureReasonFilter = 'all' | 'empty' | 'filled';
type QuickDateRange = 'month' | 'today' | 'week';

interface ReviewFilters {
  dateRange?: [Dayjs, Dayjs];
  failureReason: FailureReasonFilter;
  theme?: string;
  typeId?: number;
}

interface ReviewForm {
  failureReason: string;
  task?: Task;
}

const DEFAULT_THEME_VALUE = '__default__';
const DEFAULT_THEME_LABEL = '默认';
const FILTER_STORAGE_KEY = 'aio-life.todo.review.filters';

const filters = ref<ReviewFilters>(loadSavedFilters());
const tasks = ref<Task[]>([]);
const taskTypes = ref<TaskType[]>([]);
const loading = ref(false);
const saving = ref(false);
const modalVisible = ref(false);
const reviewForm = ref<ReviewForm>({ failureReason: '' });

const themeOptions = computed(() => {
  const themeSet = new Set<string>();
  for (const item of taskTypes.value) {
    themeSet.add(item.theme?.trim() || DEFAULT_THEME_VALUE);
  }
  return [...themeSet].map((value) => ({
    label: value === DEFAULT_THEME_VALUE ? DEFAULT_THEME_LABEL : value,
    value,
  }));
});

const filteredTaskTypes = computed(() =>
  filterTypesByTheme(taskTypes.value, filters.value.theme),
);
const hasActiveFilters = computed(
  () =>
    filters.value.failureReason !== 'all' ||
    !!filters.value.theme ||
    !!filters.value.typeId ||
    !!filters.value.dateRange,
);
const emptyText = computed(() =>
  hasActiveFilters.value ? '当前筛选无失败代办' : '暂无失败代办',
);

onMounted(async () => {
  await initReviewPage();
});

function createDefaultFilters(): ReviewFilters {
  return {
    failureReason: 'all',
  };
}

function loadSavedFilters(): ReviewFilters {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return createDefaultFilters();
    const parsed = JSON.parse(raw) as {
      dateRange?: [string, string];
      failureReason?: FailureReasonFilter;
      theme?: string;
      typeId?: number;
    };
    return {
      dateRange: parsed.dateRange
        ? [dayjs(parsed.dateRange[0]), dayjs(parsed.dateRange[1])]
        : undefined,
      failureReason: parsed.failureReason ?? 'all',
      theme: parsed.theme,
      typeId: parsed.typeId,
    };
  } catch {
    return createDefaultFilters();
  }
}

function saveFilters() {
  const [startDate, endDate] = filters.value.dateRange ?? [];
  localStorage.setItem(
    FILTER_STORAGE_KEY,
    JSON.stringify({
      dateRange:
        startDate && endDate
          ? [startDate.toISOString(), endDate.toISOString()]
          : undefined,
      failureReason: filters.value.failureReason,
      theme: filters.value.theme,
      typeId: filters.value.typeId,
    }),
  );
}

async function initReviewPage() {
  loading.value = true;
  try {
    await loadTaskTypes();
    await loadFailedTasks();
  } catch (error) {
    console.error('加载复盘列表失败', error);
    message.error('加载复盘列表失败');
  } finally {
    loading.value = false;
  }
}

async function loadTaskTypes() {
  taskTypes.value = await getTaskTypeList();
}

async function loadFailedTasks() {
  loading.value = true;
  try {
    const res = await getTaskList(buildTaskQueryParams());
    tasks.value = sortTasks(filterDefaultThemeTasks(res?.items ?? []));
    saveFilters();
  } finally {
    loading.value = false;
  }
}

function buildTaskQueryParams(): TaskQueryParams {
  const params: TaskQueryParams = {
    isCompleted: 2,
    pageSize: 500,
  };

  if (filters.value.theme && filters.value.theme !== DEFAULT_THEME_VALUE) {
    params.theme = filters.value.theme;
  }
  if (filters.value.typeId) {
    params.typeId = filters.value.typeId;
  }
  if (filters.value.failureReason === 'filled') {
    params.hasFailureReason = true;
  }
  if (filters.value.failureReason === 'empty') {
    params.hasFailureReason = false;
  }

  const [startDate, endDate] = filters.value.dateRange ?? [];
  if (startDate) {
    params.startDate = startDate.format('YYYY-MM-DD');
  }
  if (endDate) {
    params.endDate = endDate.format('YYYY-MM-DD');
  }

  return params;
}

function filterDefaultThemeTasks(list: Task[]) {
  if (filters.value.theme !== DEFAULT_THEME_VALUE || filters.value.typeId) {
    return list;
  }
  return list.filter((task) => !task.theme);
}

function sortTasks(list: Task[]) {
  return [...list].sort((left, right) => {
    const leftTime = dayjs(left.endTime || left.dueDate || left.startTime).valueOf();
    const rightTime = dayjs(right.endTime || right.dueDate || right.startTime).valueOf();
    return rightTime - leftTime;
  });
}

function getTypeThemeValue(type?: TaskType) {
  return type?.theme?.trim() || DEFAULT_THEME_VALUE;
}

function filterTypesByTheme(types: TaskType[], theme?: string) {
  if (!theme) {
    return types;
  }
  return types.filter((type) => getTypeThemeValue(type) === theme);
}

function getTaskTypeLabel(task: Task) {
  if (!task.typeName) return '未分类';
  return task.typeDeleted ? `${task.typeName}（已删除）` : task.typeName;
}

function getTaskThemeLabel(task: Task) {
  return task.theme || DEFAULT_THEME_LABEL;
}

function formatDate(task: Task) {
  const value = task.endTime || task.dueDate || task.startTime;
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '未设置';
}

function handleThemeChange() {
  if (
    filters.value.typeId &&
    !filteredTaskTypes.value.some((item) => item.id === filters.value.typeId)
  ) {
    filters.value.typeId = undefined;
  }
  void loadFailedTasks();
}

async function resetFilters() {
  filters.value = createDefaultFilters();
  await loadFailedTasks();
}

function getQuickDateRange(range: QuickDateRange): [Dayjs, Dayjs] {
  if (range === 'today') {
    return [dayjs().startOf('day'), dayjs().endOf('day')];
  }
  return [dayjs().startOf(range), dayjs().endOf(range)];
}

function isQuickDateRangeActive(range: QuickDateRange) {
  const [currentStart, currentEnd] = filters.value.dateRange ?? [];
  if (!currentStart || !currentEnd) {
    return false;
  }
  const [targetStart, targetEnd] = getQuickDateRange(range);
  return (
    currentStart.isSame(targetStart, 'day') &&
    currentEnd.isSame(targetEnd, 'day')
  );
}

async function setQuickDateRange(range: QuickDateRange) {
  filters.value.dateRange = getQuickDateRange(range);
  await loadFailedTasks();
}

function openReviewModal(task: Task) {
  reviewForm.value = {
    failureReason: task.failureReason ?? '',
    task,
  };
  modalVisible.value = true;
}

async function saveFailureReason() {
  const task = reviewForm.value.task;
  if (!task) {
    return;
  }

  saving.value = true;
  try {
    await updateTask({
      columnId: task.columnId,
      content: task.content,
      detail: task.detail,
      dueDate: task.dueDate,
      endTime: task.endTime,
      failureReason: reviewForm.value.failureReason.trim(),
      id: task.id,
      isCompleted: 2,
      startTime: task.startTime,
      typeId: task.typeId ?? 0,
    });
    message.success('复盘原因已保存');
    modalVisible.value = false;
    await loadFailedTasks();
  } catch (error) {
    console.error('保存复盘原因失败', error);
    message.error('保存复盘原因失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="review-page">
    <div class="review-header">
      <h2 class="review-title">失败复盘</h2>
      <div class="review-filters">
        <ASelect
          v-model:value="filters.theme"
          allow-clear
          class="filter-control"
          placeholder="主题"
          @change="handleThemeChange"
        >
          <ASelectOption
            v-for="item in themeOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </ASelectOption>
        </ASelect>

        <ASelect
          v-model:value="filters.typeId"
          allow-clear
          class="filter-control"
          placeholder="类型"
          @change="loadFailedTasks"
        >
          <ASelectOption
            v-for="item in filteredTaskTypes"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </ASelectOption>
        </ASelect>

        <ASelect
          v-model:value="filters.failureReason"
          class="filter-control"
          placeholder="失败原因"
          @change="loadFailedTasks"
        >
          <ASelectOption value="all">全部</ASelectOption>
          <ASelectOption value="filled">已填写</ASelectOption>
          <ASelectOption value="empty">未填写</ASelectOption>
        </ASelect>

        <ARangePicker
          v-model:value="filters.dateRange"
          class="date-range-control"
          @change="loadFailedTasks"
        />

        <AButton
          class="quick-filter-button"
          :class="{ 'is-active': isQuickDateRangeActive('today') }"
          :type="isQuickDateRangeActive('today') ? 'primary' : 'default'"
          @click="setQuickDateRange('today')"
        >
          今天
        </AButton>
        <AButton
          class="quick-filter-button"
          :class="{ 'is-active': isQuickDateRangeActive('week') }"
          :type="isQuickDateRangeActive('week') ? 'primary' : 'default'"
          @click="setQuickDateRange('week')"
        >
          本周
        </AButton>
        <AButton
          class="quick-filter-button"
          :class="{ 'is-active': isQuickDateRangeActive('month') }"
          :type="isQuickDateRangeActive('month') ? 'primary' : 'default'"
          @click="setQuickDateRange('month')"
        >
          本月
        </AButton>

        <AButton @click="resetFilters">
          <ReloadOutlined />
          重置
        </AButton>
      </div>
    </div>

    <div class="review-list" :class="{ loading }">
      <AEmpty
        v-if="!loading && tasks.length === 0"
        :description="emptyText"
      />

      <template v-else>
        <article
          v-for="task in tasks"
          :key="task.id"
          class="review-item"
        >
          <div class="review-item-main">
            <div class="review-item-title-row">
              <h3 class="review-item-title">{{ task.content }}</h3>
              <ATag color="error">已失败</ATag>
            </div>
            <p class="review-item-detail">
              {{ task.detail || '没有补充详情' }}
            </p>
            <div class="review-item-meta">
              <ATag :color="task.typeColor || 'blue'">
                {{ getTaskTypeLabel(task) }}
              </ATag>
              <ATag>{{ getTaskThemeLabel(task) }}</ATag>
              <span class="review-date">截止 {{ formatDate(task) }}</span>
            </div>
            <div
              class="failure-reason"
              :class="{ empty: !task.failureReason }"
            >
              {{ task.failureReason || '未填写失败原因' }}
            </div>
          </div>

          <AButton type="primary" @click="openReviewModal(task)">
            <EditOutlined />
            复盘
          </AButton>
        </article>
      </template>
    </div>

    <AModal
      v-model:open="modalVisible"
      :confirm-loading="saving"
      destroy-on-close
      title="填写失败原因"
      @ok="saveFailureReason"
    >
      <div class="modal-task-title">
        {{ reviewForm.task?.content }}
      </div>
      <ATextarea
        v-model:value="reviewForm.failureReason"
        :maxlength="500"
        :rows="6"
        placeholder="记录这次代办失败的原因"
        show-count
      />
    </AModal>
  </div>
</template>

<style scoped>
.review-page {
  min-height: 100%;
  padding: 28px 32px 48px;
  background: #f5f7fb;
}

.review-header {
  width: min(1100px, 100%);
  margin: 0 auto 16px;
}

.review-title {
  margin: 0 0 14px;
  color: #101828;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0;
}

.review-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.filter-control {
  width: 150px;
}

.date-range-control {
  width: 260px;
}

.quick-filter-button.is-active {
  font-weight: 700;
  box-shadow: 0 6px 14px rgb(22 119 255 / 22%);
}

.review-list {
  display: grid;
  width: min(1100px, 100%);
  gap: 12px;
  margin: 0 auto;
}

.review-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-left: 4px solid #ff4d4f;
  border-radius: 8px;
}

.review-item-title-row,
.review-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.review-item-title {
  margin: 0;
  color: #101828;
  font-size: 18px;
  font-weight: 700;
}

.review-item-detail {
  margin: 8px 0 10px;
  color: #667085;
  font-size: 14px;
}

.review-date {
  color: #667085;
  font-size: 13px;
}

.failure-reason {
  margin-top: 12px;
  padding: 10px 12px;
  color: #344054;
  background: #f9fafb;
  border: 1px solid #eaecf0;
  border-radius: 6px;
  white-space: pre-wrap;
}

.failure-reason.empty {
  color: #d92d20;
  background: #fff5f5;
  border-color: #ffd6d6;
}

.modal-task-title {
  margin-bottom: 12px;
  color: #101828;
  font-weight: 600;
}

@media (max-width: 768px) {
  .review-page {
    padding: 20px 14px 32px;
  }

  .filter-control,
  .date-range-control {
    width: 100%;
  }

  .review-item {
    grid-template-columns: 1fr;
  }
}
</style>
