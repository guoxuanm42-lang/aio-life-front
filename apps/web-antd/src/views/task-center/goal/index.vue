<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';

import {
  SearchOutlined,
  CalendarOutlined,
} from '@ant-design/icons-vue';
import {
  Button as AButton,
  DatePicker as ADatePicker,
  Empty as AEmpty,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal,
  Select as ASelect,
  SelectOption as ASelectOption,
  Textarea as ATextarea,
  Tag as ATag,
  Progress as AProgress,
  message,
  Spin as ASpin,
  Slider as ASlider,
} from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';
import dayjs, { Dayjs } from 'dayjs';

import {
  getGoalList,
  createGoal,
  updateGoal,
  deleteGoals,
  type GoalEntity,
  type GoalQueryParams,
} from '#/api/core/goal';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

interface FormState {
  id?: number;
  title: string;
  type: number;
  status: number;
  progress: number;
  targetValue?: number;
  currentValue?: number;
  startDate?: Dayjs;
  endDate?: Dayjs;
  description: string;
  tags: string;
}

// Data
const goals = ref<GoalEntity[]>([]);
const loading = ref(false);

// Filters
const filters = ref<GoalQueryParams>({
  keyword: '',
  type: undefined,
  status: undefined,
});

// Modal & Form
const modalVisible = ref(false);
const formRef = ref();
const modalTitle = ref('添加目标');
const submitLoading = ref(false);

const formState = ref<FormState>({
  title: '',
  type: 1,
  status: 0,
  progress: 0,
  targetValue: undefined,
  currentValue: undefined,
  startDate: undefined,
  endDate: undefined,
  description: '',
  tags: '',
});

const rules: Record<string, Rule[]> = {
  title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
};

// Computed properties for UI mapping
const typeMap: Record<number, { label: string; color: string }> = {
  1: { label: '日目标', color: 'green' },
  2: { label: '周目标', color: 'cyan' },
  3: { label: '月度目标', color: 'blue' },
  4: { label: '季度目标', color: 'orange' },
  5: { label: '半年目标', color: 'gold' },
  6: { label: '年度目标', color: 'red' },
  7: { label: '三年目标', color: 'purple' },
  8: { label: '五年目标', color: 'magenta' },
  9: { label: '十年目标', color: 'volcano' },
  10: { label: '人生目标', color: 'geekblue' },
};

const statusMap: Record<number, { label: string; color: string }> = {
  0: { label: '待开始', color: 'default' },
  1: { label: '进行中', color: 'processing' },
  2: { label: '已完成', color: 'success' },
  3: { label: '已放弃', color: 'error' },
};

const autoCalculateDates = (type: number) => {
  const now = dayjs();
  let startDate: Dayjs;
  let endDate: Dayjs;

  switch (type) {
    case 1: // 日目标
      startDate = now.startOf('day');
      endDate = now.endOf('day');
      break;
    case 2: // 周目标
      startDate = now.startOf('week');
      endDate = now.endOf('week');
      break;
    case 3: // 月度目标
      startDate = now.startOf('month');
      endDate = now.endOf('month');
      break;
    case 4: // 季度目标
      startDate = now.startOf('quarter');
      endDate = now.endOf('quarter');
      break;
    case 5: // 半年目标
      const isFirstHalf = now.month() < 6;
      startDate = isFirstHalf ? now.month(0).startOf('month') : now.month(6).startOf('month');
      endDate = isFirstHalf ? now.month(5).endOf('month') : now.month(11).endOf('month');
      break;
    case 6: // 年度目标
      startDate = now.startOf('year');
      endDate = now.endOf('year');
      break;
    case 7: // 三年目标
      startDate = now.startOf('day');
      endDate = now.add(3, 'year').endOf('day');
      break;
    case 8: // 五年目标
      startDate = now.startOf('day');
      endDate = now.add(5, 'year').endOf('day');
      break;
    case 9: // 十年目标
      startDate = now.startOf('day');
      endDate = now.add(10, 'year').endOf('day');
      break;
    case 10: // 人生目标
      startDate = now.startOf('day');
      endDate = now.year(2050).month(11).date(31).endOf('day');
      break;
    default:
      return;
  }

  formState.value.startDate = startDate;
  formState.value.endDate = endDate;
};

watch(() => formState.value.type, (newType) => {
  if (newType && modalVisible.value) {
    autoCalculateDates(newType);
  }
});

// Load Data
const loadData = async () => {
  try {
    loading.value = true;
    const res = await getGoalList({
      ...filters.value,
    });
    goals.value = res;
  } catch (error) {
    console.error('Failed to load goals:', error);
    message.error('加载目标列表失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});

// Actions
const handleSearch = () => {
  loadData();
};

const clearFilters = () => {
  filters.value = {
    keyword: '',
    type: undefined,
    status: undefined,
  };
  loadData();
};

const handleAdd = () => {
  modalTitle.value = '添加目标';
  formState.value = {
    title: '',
    type: 1,
    status: 0,
    progress: 0,
    targetValue: undefined,
    currentValue: undefined,
    startDate: undefined,
    endDate: undefined,
    description: '',
    tags: '',
  };
  modalVisible.value = true;
};

const handleEdit = (item: GoalEntity) => {
  modalTitle.value = '编辑目标';

  // Parse tags if stored as JSON array string, else split by comma
  let tagsStr = '';
  try {
    if (item.tags) {
      const parsed = JSON.parse(item.tags);
      tagsStr = Array.isArray(parsed) ? parsed.join(', ') : item.tags;
    }
  } catch {
    tagsStr = item.tags || '';
  }

  formState.value = {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    progress: item.progress || 0,
    targetValue: item.targetValue,
    currentValue: item.currentValue,
    startDate: item.startDate ? dayjs(item.startDate) : undefined,
    endDate: item.endDate ? dayjs(item.endDate) : undefined,
    description: item.description || '',
    tags: tagsStr,
  };
  modalVisible.value = true;
};

const handleDelete = async (id: number) => {
  Modal.confirm({
    title: '确定要删除这个目标吗？',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      try {
        await deleteGoals([id]);
        message.success('删除成功');
        loadData();
      } catch (error) {
        console.error('Failed to delete goal:', error);
        message.error('删除失败');
      }
    },
  });
};

const handleSave = async () => {
  try {
    await formRef.value.validate();
    submitLoading.value = true;

    // Convert tags string to JSON array string
    const tagsArray = formState.value.tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: GoalEntity = {
      id: formState.value.id,
      title: formState.value.title,
      type: formState.value.type,
      status: formState.value.status,
      progress: formState.value.progress,
      targetValue: formState.value.targetValue,
      currentValue: formState.value.currentValue,
      startDate: formState.value.startDate?.format('YYYY-MM-DD HH:mm:ss'),
      endDate: formState.value.endDate?.format('YYYY-MM-DD HH:mm:ss'),
      description: formState.value.description,
      tags: JSON.stringify(tagsArray),
    };

    if (formState.value.id) {
      await updateGoal(payload);
      message.success('更新成功');
    } else {
      await createGoal(payload);
      message.success('创建成功');
    }

    modalVisible.value = false;
    loadData();
  } catch (error) {
    console.error('Validate Failed:', error);
  } finally {
    submitLoading.value = false;
  }
};

const calculateProgress = (item: GoalEntity) => {
  if (item.targetValue && item.targetValue > 0) {
    return Math.min(100, Math.round((item.currentValue || 0) / item.targetValue * 100));
  }
  return 0;
};

// Helper methods for UI
const parseTags = (tagsStr?: string): string[] => {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [tagsStr];
  } catch {
    return [tagsStr];
  }
};

const getStatusBadgeColor = (status: number) => {
  switch (status) {
    case 0: return 'bg-gray-400';
    case 1: return 'bg-blue-500';
    case 2: return 'bg-green-500';
    case 3: return 'bg-red-500';
    default: return 'bg-gray-400';
  }
};

</script>

<template>
  <div class="min-h-full bg-background/50 p-4">
    <!-- Header -->
    <div class="mb-6">
      <div>
        <p class="text-gray-500">规划与追踪你的目标</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-8 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-4">
        <AInput
          v-model:value="filters.keyword"
          placeholder="搜索标题、描述、标签..."
          class="w-64"
          allow-clear
          @press-enter="handleSearch"
        >
          <template #prefix><SearchOutlined class="text-gray-400" /></template>
        </AInput>

        <ASelect
          v-model:value="filters.type"
          placeholder="目标类型"
          class="w-32"
          allow-clear
          @change="handleSearch"
        >
          <ASelectOption :value="1">日目标</ASelectOption>
          <ASelectOption :value="2">周目标</ASelectOption>
          <ASelectOption :value="3">月度目标</ASelectOption>
          <ASelectOption :value="4">季度目标</ASelectOption>
          <ASelectOption :value="5">半年目标</ASelectOption>
          <ASelectOption :value="6">年度目标</ASelectOption>
          <ASelectOption :value="7">三年目标</ASelectOption>
          <ASelectOption :value="8">五年目标</ASelectOption>
          <ASelectOption :value="9">十年目标</ASelectOption>
          <ASelectOption :value="10">人生目标</ASelectOption>
        </ASelect>

        <ASelect
          v-model:value="filters.status"
          placeholder="目标状态"
          class="w-32"
          allow-clear
          @change="handleSearch"
        >
          <ASelectOption :value="0">待开始</ASelectOption>
          <ASelectOption :value="1">进行中</ASelectOption>
          <ASelectOption :value="2">已完成</ASelectOption>
          <ASelectOption :value="3">已放弃</ASelectOption>
        </ASelect>

        <AButton @click="handleSearch" type="primary" ghost>查询</AButton>
        <AButton @click="clearFilters">重置</AButton>
      </div>
    </div>

    <!-- Card Grid -->
    <ASpin :spinning="loading">
      <div v-if="goals.length === 0 && !loading" class="py-20 text-center text-gray-400">
        <AEmpty description="暂无目标记录" />
      </div>

      <div v-else class="grid grid-cols-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="item in goals"
          :key="item.id"
          class="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-4 sm:p-6 cursor-pointer apple-card"
          @click="handleEdit(item)"
          @contextmenu.prevent="handleDelete(item.id!)"
        >
          <!-- Card Header -->
          <div>
            <div class="mb-3 flex items-start justify-between">
              <div class="flex items-center gap-2 max-w-full">
                <ATag :color="typeMap[item.type]?.color || 'default'" class="m-0 border-0 font-medium">
                  {{ typeMap[item.type]?.label }}
                </ATag>
                <div class="flex items-center gap-1.5 ml-1">
                  <div class="w-2 h-2 rounded-full" :class="getStatusBadgeColor(item.status)"></div>
                  <span class="text-xs text-muted-foreground">{{ statusMap[item.status]?.label }}</span>
                </div>
              </div>
            </div>

            <h3 class="mb-2 text-lg font-bold text-card-foreground line-clamp-2" :title="item.title">
              {{ item.title }}
            </h3>

            <!-- Tags -->
            <div class="mb-3 flex flex-wrap gap-1.5" v-if="item.tags && parseTags(item.tags).length > 0">
              <span
                v-for="tag in parseTags(item.tags)"
                :key="tag"
                class="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {{ tag }}
              </span>
            </div>

            <p class="mb-4 text-sm text-muted-foreground line-clamp-3" v-if="item.description">
              {{ item.description }}
            </p>
          </div>

          <!-- Card Footer -->
          <div class="mt-4">
            <div class="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <div class="flex items-center gap-1">
                <CalendarOutlined />
                <span v-if="item.startDate || item.endDate">
                  {{ item.startDate ? dayjs(item.startDate).format('MM-DD') : '不限' }} ~
                  {{ item.endDate ? dayjs(item.endDate).format('MM-DD') : '不限' }}
                </span>
                <span v-else>无期限</span>
              </div>
              <span class="font-medium" :class="{'text-success': item.status === 2}">
                {{ calculateProgress(item) }}%
              </span>
            </div>
            <AProgress
              :percent="calculateProgress(item)"
              :show-info="false"
              size="small"
              :status="item.status === 2 ? 'success' : (item.status === 3 ? 'exception' : 'active')"
            />
          </div>
        </div>
      </div>
    </ASpin>

    <!-- Add/Edit Modal -->
    <Modal
      v-model:open="modalVisible"
      :title="modalTitle"
      :confirm-loading="submitLoading"
      @ok="handleSave"
      width="600px"
    >
      <AForm
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
        class="mt-4"
      >
        <AFormItem label="目标标题" name="title">
          <AInput
            v-model:value="formState.title"
            placeholder="请输入目标标题，回车保存"
            allow-clear
            @pressEnter="handleSave"
          />
        </AFormItem>

        <div class="flex gap-4">
          <AFormItem label="目标类型" name="type" class="flex-1">
            <ASelect v-model:value="formState.type" placeholder="请选择类型">
              <ASelectOption :value="1">日目标</ASelectOption>
              <ASelectOption :value="2">周目标</ASelectOption>
              <ASelectOption :value="3">月度目标</ASelectOption>
              <ASelectOption :value="4">季度目标</ASelectOption>
              <ASelectOption :value="5">半年目标</ASelectOption>
              <ASelectOption :value="6">年度目标</ASelectOption>
              <ASelectOption :value="7">三年目标</ASelectOption>
              <ASelectOption :value="8">五年目标</ASelectOption>
              <ASelectOption :value="9">十年目标</ASelectOption>
              <ASelectOption :value="10">人生目标</ASelectOption>
            </ASelect>
          </AFormItem>

          <AFormItem label="当前状态" name="status" class="flex-1">
            <ASelect v-model:value="formState.status" placeholder="请选择状态">
              <ASelectOption :value="0">待开始</ASelectOption>
              <ASelectOption :value="1">进行中</ASelectOption>
              <ASelectOption :value="2">已完成</ASelectOption>
              <ASelectOption :value="3">已放弃</ASelectOption>
            </ASelect>
          </AFormItem>
        </div>

        <AFormItem label="进度 (%)" name="progress">
          <ASlider v-model:value="formState.progress" :min="0" :max="100" />
        </AFormItem>

        <div class="flex gap-4">
          <AFormItem label="当前值" name="currentValue" class="flex-1">
            <AInputNumber
              v-model:value="formState.currentValue"
              :min="0"
              placeholder="当前完成值"
              class="w-full"
            />
          </AFormItem>
          <AFormItem label="目标值" name="targetValue" class="flex-1">
            <AInputNumber
              v-model:value="formState.targetValue"
              :min="0"
              placeholder="目标总值"
              class="w-full"
            />
          </AFormItem>
        </div>

        <div class="flex gap-4">
          <AFormItem label="开始时间" name="startDate" class="flex-1">
            <ADatePicker
              v-model:value="formState.startDate"
              class="w-full"
              placeholder="可选"
              show-time
            />
          </AFormItem>

          <AFormItem label="结束时间" name="endDate" class="flex-1">
            <ADatePicker
              v-model:value="formState.endDate"
              class="w-full"
              placeholder="可选"
              show-time
            />
          </AFormItem>
        </div>

        <AFormItem label="标签" name="tags">
          <AInput
            v-model:value="formState.tags"
            placeholder="请输入标签，多个标签请用逗号分隔"
            allow-clear
          />
        </AFormItem>

        <AFormItem label="目标描述" name="description">
          <ATextarea
            v-model:value="formState.description"
            :rows="4"
            placeholder="请输入详细描述..."
            allow-clear
          />
        </AFormItem>
      </AForm>
    </Modal>

    <GlobalFloatBtn @click="handleAdd" />
  </div>
</template>

<style scoped>
.apple-card {
  will-change: transform, box-shadow;
  transform: scale(1);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.04);
  transition:
    transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
    box-shadow 0.35s cubic-bezier(0.25, 0.1, 0.25, 1),
    border-color 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  border: 1px solid transparent;
}

.apple-card:hover {
  transform: scale(1.005);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.1),
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 16px 48px rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.06);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
