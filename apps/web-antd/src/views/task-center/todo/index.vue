<script lang="ts" setup>
import type { Task, TaskType } from '#/api/core/todo';

import { computed, onActivated, onMounted, ref } from 'vue';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button as AButton,
  Checkbox as ACheckbox,
  DatePicker as ADatePicker,
  Input as AInput,
  Modal as AModal,
  Popconfirm as APopconfirm,
  RangePicker as ARangePicker,
  Select as ASelect,
  SelectOption as ASelectOption,
  Tag as ATag,
  Textarea as ATextarea,
  message,
} from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';

import {
  deleteTask,
  getTaskColumnList,
  getTaskList,
  getTaskTypeList,
  saveColumn,
  saveTask,
  updateTask,
} from '#/api/core/todo';

interface TaskColumn {
  id: number;
  title: string;
}

interface TodoForm {
  columnId?: number;
  content: string;
  detail?: string;
  endTime?: Dayjs;
  id?: number;
  isCompleted: TodoStatus;
  startTime?: Dayjs;
  theme?: string;
  typeId?: number;
}

type TodoStatus = 0 | 1 | 2;
type TodoStatusFilter = 'all' | 'valid' | TodoStatus;
type QuickDateRange = 'month' | 'today' | 'week';

interface TodoFilters {
  dateRange?: [Dayjs, Dayjs];
  isCompleted: TodoStatusFilter;
  theme?: string;
  typeId?: number;
}

const DEFAULT_THEME_VALUE = '__default__';
const DEFAULT_THEME_LABEL = '默认';
const FILTER_STORAGE_KEY = 'aio-life.todo.filters';
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const tasks = ref<Task[]>([]);
const taskTypes = ref<TaskType[]>([]);
const initialized = ref(false);
const loading = ref(false);
const saving = ref(false);
const modalVisible = ref(false);
const isEditing = ref(false);
const createMode = ref<'detail' | 'quick'>('quick');
const defaultColumnId = ref<number>();
const form = ref<TodoForm>(createEmptyForm());
const filters = ref<TodoFilters>(loadSavedFilters());

const isQuickCreate = computed(
  () => !isEditing.value && createMode.value === 'quick',
);
const modalTitle = computed(() => {
  if (isEditing.value) return '编辑代办';
  return isQuickCreate.value ? '新增代办' : '详细编辑';
});
const hasActiveFilters = computed(
  () =>
    filters.value.isCompleted !== 0 ||
    !!filters.value.theme ||
    !!filters.value.typeId ||
    !!filters.value.dateRange,
);
const emptyText = computed(() =>
  hasActiveFilters.value
    ? '当前筛选无结果'
    : '暂无代办，点击右下角新增',
);

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

const formFilteredTaskTypes = computed(() =>
  filterTypesByTheme(taskTypes.value, form.value.theme),
);

onMounted(async () => {
  await initTodoPage();
});

onActivated(async () => {
  if (!initialized.value) {
    return;
  }
  filters.value = createDefaultFilters();
  await loadTasks();
});

function createDefaultFilters(): TodoFilters {
  return {
    dateRange: getQuickDateRange('today'),
    isCompleted: 'valid',
  };
}

function loadSavedFilters(): TodoFilters {
  return createDefaultFilters();
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
      isCompleted: filters.value.isCompleted,
      theme: filters.value.theme,
      typeId: filters.value.typeId,
    }),
  );
}

function createEmptyForm(): TodoForm {
  return {
    content: '',
    detail: '',
    endTime: dayjs().endOf('day'),
    isCompleted: 0,
    startTime: dayjs(),
  };
}

async function initTodoPage() {
  loading.value = true;
  try {
    await ensureDefaultColumn();
    await loadTaskTypes();
    await loadTasks();
    initialized.value = true;
  } catch (error) {
    console.error('初始化代办失败', error);
    message.error('加载代办失败');
  } finally {
    loading.value = false;
  }
}

async function ensureDefaultColumn() {
  const res = await getTaskColumnList({});
  const items = (res?.items ?? []) as TaskColumn[];
  if (items.length > 0) {
    defaultColumnId.value = items[0]?.id;
    return;
  }

  const savedColumn = await saveColumn({
    title: '默认',
  });
  defaultColumnId.value = savedColumn.id;
}

async function loadTaskTypes() {
  taskTypes.value = await getTaskTypeList();
}

async function loadTasks() {
  const params = buildTaskQueryParams();
  const res = await getTaskList(params);
  tasks.value = sortTodoTasks(
    filterStatusGroupTasks(filterDefaultThemeTasks((res?.items ?? []) as Task[])),
  );
  saveFilters();
}

function buildTaskQueryParams() {
  const params: Record<string, any> = {
    pageSize: 500,
  };
  if (filters.value.isCompleted !== 'all') {
    if (filters.value.isCompleted === 'valid') {
      params.statusGroup = 'valid';
    } else {
      params.isCompleted = filters.value.isCompleted;
    }
  }
  if (filters.value.theme && filters.value.theme !== DEFAULT_THEME_VALUE) {
    params.theme = filters.value.theme;
  }
  if (filters.value.typeId) {
    params.typeId = filters.value.typeId;
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

function filterStatusGroupTasks(list: Task[]) {
  if (filters.value.isCompleted !== 'valid') {
    return list;
  }
  return list.filter((task) => (task.isCompleted ?? 0) !== 2);
}

function sortTodoTasks(list: Task[]) {
  return [...list].sort((left, right) => {
    const completedDiff = (left.isCompleted ?? 0) - (right.isCompleted ?? 0);
    if (completedDiff !== 0) return completedDiff;
    return getSortTime(left) - getSortTime(right);
  });
}

function getSortTime(task: Task) {
  const date = task.startTime || task.endTime || task.dueDate;
  return date ? dayjs(date).valueOf() : Number.MAX_SAFE_INTEGER;
}

function formatListDate(task: Task) {
  const date = task.endTime || task.dueDate || task.startTime;
  if (!date) return '';
  const value = dayjs(date);
  return `${WEEKDAY_LABELS[value.day()]} ${value.format('MM-DD HH:mm')}`;
}

function formatDateTimeForSubmit(value?: Dayjs | string) {
  if (!value) return undefined;
  return dayjs.isDayjs(value) ? value.format('YYYY-MM-DDTHH:mm:ss') : value;
}

function getStatusLabel(status?: number) {
  if (status === 1) return '已完成';
  if (status === 2) return '已失败';
  return '未完成';
}

function getStatusColor(status?: number) {
  if (status === 1) return 'success';
  if (status === 2) return 'error';
  return 'processing';
}

function getTaskThemeLabel(task: Task) {
  return task.theme || DEFAULT_THEME_LABEL;
}

function getTaskTypeLabel(task: Task) {
  if (!task.typeName) return '未分类';
  return task.typeDeleted ? `${task.typeName}（已删除）` : task.typeName;
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

function getTaskType(typeId?: number) {
  if (!typeId) return undefined;
  return taskTypes.value.find((item) => item.id === typeId);
}

function handleFilterThemeChange() {
  if (
    filters.value.typeId &&
    !filteredTaskTypes.value.some((item) => item.id === filters.value.typeId)
  ) {
    filters.value.typeId = undefined;
  }
  void loadTasks();
}

function handleFormThemeChange() {
  if (
    form.value.typeId &&
    !formFilteredTaskTypes.value.some((item) => item.id === form.value.typeId)
  ) {
    form.value.typeId = undefined;
  }
}

async function handleFilterChange() {
  await loadTasks();
}

async function resetFilters() {
  filters.value = createDefaultFilters();
  await loadTasks();
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
  await loadTasks();
}

function openCreateModal() {
  isEditing.value = false;
  createMode.value = 'quick';
  form.value = {
    ...createEmptyForm(),
    columnId: defaultColumnId.value,
  };
  modalVisible.value = true;
}

function openEditModal(record: Record<string, any>) {
  const task = record as Task;
  const selectedType = getTaskType(task.typeId);
  isEditing.value = true;
  createMode.value = 'detail';
  form.value = {
    columnId: task.columnId,
    content: task.content,
    detail: task.detail ?? '',
    endTime: task.endTime ? dayjs(task.endTime) : undefined,
    id: task.id,
    isCompleted: (task.isCompleted ?? 0) as TodoStatus,
    startTime: task.startTime ? dayjs(task.startTime) : undefined,
    theme: selectedType ? getTypeThemeValue(selectedType) : undefined,
    typeId: task.typeId,
  };
  modalVisible.value = true;
}

async function handleSave() {
  const content = form.value.content.trim();
  if (!content) {
    message.warning('请输入代办内容');
    return;
  }

  saving.value = true;
  try {
    const isQuick = isQuickCreate.value;
    const createStartTime = dayjs();
    const createEndTime = createStartTime.endOf('day');
    const payload = {
      columnId: form.value.columnId ?? defaultColumnId.value,
      content,
      detail: isQuick ? '' : (form.value.detail?.trim() ?? ''),
      dueDate: formatDateTimeForSubmit(isQuick ? createEndTime : form.value.endTime),
      endTime: formatDateTimeForSubmit(isQuick ? createEndTime : form.value.endTime),
      id: form.value.id,
      isCompleted: isQuick ? 0 : form.value.isCompleted,
      startTime: formatDateTimeForSubmit(isQuick ? createStartTime : form.value.startTime),
      typeId: isQuick ? 0 : (form.value.typeId ?? 0),
    };

    if (isEditing.value) {
      await updateTask(payload);
      message.success('代办已更新');
    } else {
      await saveTask(payload);
      message.success('代办已创建');
    }
    modalVisible.value = false;
    await loadTasks();
  } catch (error) {
    console.error('保存代办失败', error);
    message.error('保存代办失败');
  } finally {
    saving.value = false;
  }
}

function handleQuickCreateEnter(event: KeyboardEvent) {
  if (!isQuickCreate.value) {
    return;
  }
  event.preventDefault();
  void handleSave();
}

function openCreateDetailMode() {
  createMode.value = 'detail';
}

async function handleCompleteChange(record: Record<string, any>, checked: boolean) {
  const task = record as Task;
  if ((task.isCompleted ?? 0) === 2) {
    message.warning('失败代办请在复盘模块处理');
    return;
  }

  const previousValue = task.isCompleted ?? 0;
  task.isCompleted = checked ? 1 : 0;
  tasks.value = sortTodoTasks(tasks.value);

  try {
    await updateTask({
      columnId: task.columnId,
      content: task.content,
      detail: task.detail,
      dueDate: task.dueDate,
      endTime: task.endTime,
      id: task.id,
      isCompleted: task.isCompleted,
      startTime: task.startTime,
      typeId: task.typeId ?? 0,
    });
    await loadTasks();
  } catch (error) {
    task.isCompleted = previousValue;
    tasks.value = sortTodoTasks(tasks.value);
    console.error('更新完成状态失败', error);
    message.error('更新完成状态失败');
  }
}

async function handleDelete(record: Record<string, any>) {
  const task = record as Task;
  try {
    await deleteTask({ id: task.id });
    tasks.value = tasks.value.filter((item) => item.id !== task.id);
    message.success('代办已删除');
  } catch (error) {
    console.error('删除代办失败', error);
    message.error('删除代办失败');
  }
}
</script>

<template>
  <div class="todo-page">
    <div class="todo-header">
      <h2 class="todo-title">代办清单</h2>
      <div class="todo-filters">
        <ASelect
          v-model:value="filters.theme"
          allow-clear
          class="filter-control"
          placeholder="主题"
          @change="handleFilterThemeChange"
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
          @change="handleFilterChange"
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
          v-model:value="filters.isCompleted"
          class="filter-control"
          placeholder="状态"
          @change="handleFilterChange"
        >
          <ASelectOption value="all">全部</ASelectOption>
          <ASelectOption value="valid">有效任务</ASelectOption>
          <ASelectOption :value="0">未完成</ASelectOption>
          <ASelectOption :value="1">已完成</ASelectOption>
          <ASelectOption :value="2">已失败</ASelectOption>
        </ASelect>

        <ARangePicker
          v-model:value="filters.dateRange"
          class="date-range-control"
          @change="handleFilterChange"
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

        <AButton @click="resetFilters">重置</AButton>
      </div>
    </div>

    <div class="todo-card">
      <div v-if="loading" class="todo-empty">加载中...</div>
      <div v-else-if="tasks.length === 0" class="todo-empty">{{ emptyText }}</div>
      <ul v-else class="todo-list" role="list">
        <li
          v-for="task in tasks"
          :key="task.id"
          :class="{
            'completed-item': (task.isCompleted ?? 0) === 1,
            'failed-item': (task.isCompleted ?? 0) === 2,
          }"
          class="todo-item"
        >
          <ACheckbox
            class="todo-checkbox"
            :checked="(task.isCompleted ?? 0) === 1"
            :disabled="(task.isCompleted ?? 0) === 2"
            @update:checked="
              (checked) => handleCompleteChange(task, checked === true)
            "
          />

          <button class="todo-main" type="button" @click="openEditModal(task)">
            <span class="todo-item-title">{{ task.content }}</span>
            <span class="todo-item-detail">
              {{ task.detail || '点击查看或补充详情' }}
            </span>
            <span class="todo-meta">
              <ATag class="todo-tag" :color="task.typeColor || 'blue'">
                {{ getTaskTypeLabel(task) }}
              </ATag>
              <ATag class="todo-tag" color="default">
                {{ getTaskThemeLabel(task) }}
              </ATag>
              <ATag
                class="todo-tag"
                :color="getStatusColor(task.isCompleted)"
              >
                {{ getStatusLabel(task.isCompleted) }}
              </ATag>
            </span>
          </button>

          <span class="todo-date">{{ formatListDate(task) }}</span>

          <div class="todo-actions">
            <AButton type="text" size="small" @click="openEditModal(task)">
              <template #icon><EditOutlined /></template>
            </AButton>
            <APopconfirm
              title="确定删除这条代办吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleDelete(task)"
            >
              <AButton type="text" size="small" danger>
                <template #icon><DeleteOutlined /></template>
              </AButton>
            </APopconfirm>
          </div>
        </li>
      </ul>
    </div>

    <button
      type="button"
      class="floating-add-button"
      title="新增代办"
      @click="openCreateModal"
    >
      <PlusOutlined />
    </button>

    <AModal
      v-model:open="modalVisible"
      :confirm-loading="saving"
      :title="modalTitle"
      :ok-text="isQuickCreate ? '保存' : '确定'"
      cancel-text="取消"
      :width="isQuickCreate ? '520px' : '640px'"
      :wrap-class-name="isQuickCreate ? 'todo-quick-create-modal-wrap' : ''"
      @ok="handleSave"
    >
      <div class="todo-form" :class="{ 'is-quick-create': isQuickCreate }">
        <template v-if="isQuickCreate">
          <label class="form-item quick-create-content">
            <span class="form-label">代办内容</span>
            <AInput
              v-model:value="form.content"
              placeholder="请输入代办内容"
              auto-focus
              size="large"
              @press-enter="handleQuickCreateEnter"
            />
          </label>
          <div class="quick-create-actions">
            <AButton type="link" @click="openCreateDetailMode">
              详细编辑
            </AButton>
          </div>
        </template>

        <template v-else>
          <label class="form-item">
            <span class="form-label">代办内容</span>
            <AInput
              v-model:value="form.content"
              placeholder="请输入代办内容"
              auto-focus
            />
          </label>

          <div class="date-grid">
            <label class="form-item">
              <span class="form-label">开始时间</span>
              <ADatePicker
                v-model:value="form.startTime"
                show-time
                style="width: 100%"
              />
            </label>

            <label class="form-item">
              <span class="form-label">结束时间</span>
              <ADatePicker
                v-model:value="form.endTime"
                show-time
                style="width: 100%"
              />
            </label>
          </div>

          <div class="date-grid">
            <label class="form-item">
              <span class="form-label">主题</span>
              <ASelect
                v-model:value="form.theme"
                allow-clear
                placeholder="选择主题以筛选类型"
                @change="handleFormThemeChange"
              >
                <ASelectOption
                  v-for="item in themeOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </ASelectOption>
              </ASelect>
            </label>

            <label class="form-item">
              <span class="form-label">类型</span>
              <ASelect
                v-model:value="form.typeId"
                allow-clear
                placeholder="未分类"
              >
                <ASelectOption
                  v-for="item in formFilteredTaskTypes"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name }}
                </ASelectOption>
              </ASelect>
            </label>
          </div>

          <label class="form-item">
            <span class="form-label">备注</span>
            <ATextarea
              v-model:value="form.detail"
              placeholder="可以补充说明"
              :rows="4"
            />
          </label>
        </template>
      </div>
    </AModal>
  </div>
</template>

<style scoped>
.todo-page {
  position: relative;
  min-height: calc(100vh - 140px);
  padding: 28px 32px 96px;
  background: #f5f7fb;
}

.todo-header {
  max-width: 980px;
  margin: 0 auto 18px;
}

.todo-title {
  margin: 0 0 14px;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
  color: #1f2937;
}

.todo-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.filter-control {
  width: 138px;
}

.date-range-control {
  width: 260px;
}

.quick-filter-button.is-active {
  font-weight: 700;
  box-shadow: 0 6px 14px rgb(22 119 255 / 22%);
}

.todo-card {
  max-width: 980px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.todo-list {
  padding: 0 24px;
  margin: 0;
  list-style: none;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 22px;
  min-height: 108px;
  padding: 18px 0;
  border-bottom: 1px solid #e5e7eb;
}

.todo-item:last-child {
  border-bottom: 0;
}

.todo-checkbox {
  flex: 0 0 auto;
}

:deep(.todo-checkbox .ant-checkbox-inner) {
  width: 20px;
  height: 20px;
}

:deep(.todo-checkbox .ant-checkbox-inner::after) {
  width: 6px;
  height: 10px;
}

.todo-main {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  flex: 1 1 auto;
  gap: 6px 18px;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.todo-item-title {
  min-width: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
  color: #111827;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-item-detail {
  min-width: 0;
  overflow: hidden;
  font-size: 17px;
  line-height: 1.5;
  color: #4b5563;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-meta {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 6px;
  min-width: 0;
}

.todo-tag {
  max-width: 150px;
  margin-right: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-date {
  flex: 0 0 160px;
  font-size: 16px;
  line-height: 1.4;
  color: #4b5563;
  text-align: right;
  white-space: nowrap;
}

.todo-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

:deep(.todo-actions .ant-btn) {
  width: 44px;
  height: 44px;
  font-size: 22px;
  border-radius: 10px;
}

.completed-item {
  opacity: 0.62;
}

.failed-item {
  background: linear-gradient(90deg, rgb(255 77 79 / 5%), transparent 38%);
}

.completed-item .todo-item-title,
.completed-item .todo-item-detail,
.completed-item .todo-date {
  text-decoration: line-through;
}

.todo-empty {
  padding: 44px 24px;
  font-size: 17px;
  color: #6b7280;
  text-align: center;
}

.floating-add-button {
  position: fixed;
  right: 32px;
  bottom: 36px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  padding: 0;
  font-size: 30px;
  color: #fff;
  cursor: pointer;
  background:
    linear-gradient(145deg, #4aa3ff 0%, #0b73f6 52%, #075bd8 100%);
  border: 1px solid rgb(255 255 255 / 42%);
  border-radius: 50%;
  box-shadow:
    0 18px 38px rgb(22 119 255 / 32%),
    0 8px 18px rgb(7 91 216 / 20%),
    inset 0 1px 0 rgb(255 255 255 / 36%);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}

.floating-add-button::before {
  position: absolute;
  inset: 8px;
  pointer-events: none;
  content: '';
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: 50%;
}

.floating-add-button:hover {
  filter: brightness(1.04);
  box-shadow:
    0 22px 44px rgb(22 119 255 / 38%),
    0 10px 22px rgb(7 91 216 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 44%);
  transform: translateY(-2px);
}

.floating-add-button:active {
  transform: translateY(0) scale(0.98);
}

:deep(.floating-add-button .anticon) {
  font-size: 32px;
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 14%));
}

.todo-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 8px;
}

.todo-form.is-quick-create {
  gap: 20px;
  padding: 12px 0 4px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  color: #4b5563;
}

.quick-create-content .form-label {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.quick-create-content :deep(.ant-input) {
  min-height: 52px;
  padding: 10px 14px;
  font-size: 18px;
  border-radius: 12px;
}

.quick-create-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: -8px;
}

.quick-create-actions :deep(.ant-btn) {
  height: 36px;
  padding: 0;
  font-weight: 700;
}

.date-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .todo-page {
    min-height: calc(100vh - 96px);
    padding: 16px 12px 92px;
  }

  .todo-title {
    margin-bottom: 12px;
    font-size: 22px;
  }

  .filter-control,
  .date-range-control {
    width: 100%;
  }

  .todo-list {
    padding: 0 16px;
  }

  .todo-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px 14px;
    min-height: 96px;
    padding: 16px 0;
  }

  .todo-main {
    grid-template-columns: 1fr;
    grid-column: 2;
    gap: 3px;
  }

  .todo-item-title {
    font-size: 17px;
  }

  .todo-item-detail {
    font-size: 14px;
  }

  .todo-date {
    grid-column: 2;
    font-size: 13px;
    text-align: left;
  }

  .todo-actions {
    grid-column: 3;
    grid-row: 1 / span 2;
  }

  :deep(.todo-actions .ant-btn) {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }

  .date-grid {
    grid-template-columns: 1fr;
  }

  .floating-add-button {
    right: 22px;
    bottom: 26px;
    width: 64px;
    height: 64px;
    font-size: 28px;
  }

  :global(.todo-quick-create-modal-wrap) {
    overflow: hidden;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal) {
    top: auto;
    width: 100vw !important;
    max-width: none;
    padding-bottom: 0;
    margin: 0;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-content) {
    min-height: 42dvh;
    padding: 22px 18px 0;
    border-radius: 22px 22px 0 0;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-header) {
    margin-bottom: 18px;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-title) {
    font-size: 20px;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-body) {
    padding-bottom: 12px;
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-footer) {
    position: sticky;
    bottom: 0;
    display: flex;
    gap: 12px;
    padding: 14px 0 18px;
    margin-top: 18px;
    background: var(--ant-color-bg-elevated, #fff);
  }

  :global(.todo-quick-create-modal-wrap .ant-modal-footer .ant-btn) {
    flex: 1;
    min-height: 44px;
    margin-inline-start: 0;
    font-size: 16px;
    border-radius: 999px;
  }

  .todo-form.is-quick-create {
    padding-top: 2px;
  }

  .quick-create-content :deep(.ant-input) {
    min-height: 56px;
    font-size: 18px;
  }

  .quick-create-actions :deep(.ant-btn) {
    min-height: 40px;
    font-size: 15px;
  }
}
</style>
