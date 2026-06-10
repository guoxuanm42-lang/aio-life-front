<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';
import type { Rule } from 'ant-design-vue/es/form';

import type {
  FoodRecord,
  FoodRecordDetail,
  FoodRecordImage,
  FoodRecordImageType,
  FoodRecordIngredient,
  FoodRecordSavePayload,
  FoodRecordStatistics,
  FoodRecordStatisticsNameCount,
  FoodRecordStatisticsSummary,
  FoodRecordStatus,
  FoodRecordStep,
} from '#/api/core/food-record';

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Divider,
  Empty,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  SelectOption,
  Space,
  Spin,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  Textarea,
  Tooltip,
  Upload,
} from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';

import {
  deleteFoodRecordImage,
  deleteFoodRecord,
  getFoodRecordImageBlob,
  getFoodRecordStatistics,
  getFoodRecordDetail,
  queryFoodRecords,
  saveFoodRecord,
  sortFoodRecordImages,
  updateFoodRecordImage,
  updateFoodRecord,
  uploadFoodRecordImage,
} from '#/api/core/food-record';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

const { isMobile } = usePreferences();

const statusOptions: Array<{ color: string; label: string; value: FoodRecordStatus }> = [
  { color: 'default', label: '草稿', value: 'draft' },
  { color: 'green', label: '已完成', value: 'done' },
  { color: 'orange', label: '待优化', value: 'to_improve' },
  { color: 'blue', label: '已归档', value: 'archived' },
];
const defaultStatusOption = statusOptions[0]!;

const mealTypeOptions = ['早餐', '午餐', '晚餐', '夜宵', '加餐'];
const categoryOptions = ['家常菜', '主食', '汤羹', '甜品', '烘焙', '饮品'];

const imageTypeOptions: Array<{ label: string; value: FoodRecordImageType }> = [
  { label: '食材图', value: 'ingredient' },
  { label: '过程图', value: 'process' },
  { label: '成品图', value: 'finished' },
  { label: '失败图', value: 'failed' },
  { label: '其他', value: 'other' },
];

interface FoodRecordFormState extends Omit<FoodRecordSavePayload, 'cookDate'> {
  cookDate?: Dayjs;
}

type MobileFormSection = 'basic' | 'images' | 'ingredients' | 'review' | 'steps' | 'time';
type DetailIngredientField = 'name' | 'quantity' | 'remark' | 'unit';
type DetailStepField = 'description' | 'durationMinutes' | 'stepNo' | 'title';
type DetailEditableField =
  | 'briefSummary'
  | 'cookMinutes'
  | 'difficulty'
  | 'dishName'
  | 'nextImprove'
  | 'nextTrySuggestion'
  | 'prepMinutes'
  | 'problems'
  | 'rating'
  | 'successLevel'
  | 'summary'
  | 'tasteDescription'
  | 'totalMinutes'
  | 'worthRedo';

const loading = ref(false);
const tableData = ref<FoodRecord[]>([]);
const total = ref(0);
const activeTab = ref<'list' | 'statistics'>('list');
const viewMode = ref<'card' | 'table'>('card');

const overviewLoading = ref(false);
const statisticsLoading = ref(false);
const statisticsData = ref<FoodRecordStatistics | null>(null);
const trendChartRef = ref<EchartsUIType>();
const categoryChartRef = ref<EchartsUIType>();
const mealTypeChartRef = ref<EchartsUIType>();
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);
const { renderEcharts: renderCategoryChart } = useEcharts(categoryChartRef);
const { renderEcharts: renderMealTypeChart } = useEcharts(mealTypeChartRef);

const filters = reactive({
  category: undefined as string | undefined,
  endDate: undefined as Dayjs | undefined,
  keyword: '',
  mealType: undefined as string | undefined,
  page: 1,
  pageSize: 50,
  startDate: undefined as Dayjs | undefined,
  status: undefined as FoodRecordStatus | undefined,
  tags: '',
});

const detailOpen = ref(false);
const detailLoading = ref(false);
const currentDetail = ref<FoodRecordDetail | null>(null);
const imagePreviewMap = ref<Record<string, string>>({});
const detailEditingField = ref<DetailEditableField | null>(null);
const detailFieldDraft = ref<boolean | number | string | undefined>('');
const detailInlineSaving = ref(false);
const detailIngredientEditingCell = ref<{
  field: DetailIngredientField;
  index: number;
} | null>(null);
const detailIngredientDraft = ref('');
const detailStepEditingCell = ref<{
  field: DetailStepField;
  index: number;
} | null>(null);
const detailStepDraft = ref<number | string | undefined>('');

const formOpen = ref(false);
const formRef = ref();
const formLoading = ref(false);
const formMode = ref<'add' | 'edit'>('add');
const formImages = ref<FoodRecordImage[]>([]);
const imageUploading = ref(false);
const uploadCaption = ref('');
const uploadImageType = ref<FoodRecordImageType>('finished');
const mobileFormActivePanels = reactive<Record<MobileFormSection, boolean>>({
  basic: true,
  images: false,
  ingredients: false,
  review: false,
  steps: false,
  time: false,
});

const emptyForm = (): FoodRecordFormState => ({
  briefSummary: '',
  category: undefined,
  cookDate: dayjs(),
  cookMinutes: undefined,
  difficulty: undefined,
  dishName: '',
  ingredients: [],
  mealType: undefined,
  nextImprove: '',
  nextTrySuggestion: '',
  prepMinutes: undefined,
  problems: '',
  rating: undefined,
  status: 'draft',
  steps: [],
  successLevel: undefined,
  summary: '',
  tags: '',
  tasteDescription: '',
  totalMinutes: undefined,
  worthRedo: undefined,
});

const formState = ref<FoodRecordFormState>(emptyForm());

const columns = [
  { dataIndex: 'dishName', key: 'dishName', title: '菜名' },
  { dataIndex: 'category', key: 'category', title: '分类', width: 110 },
  { dataIndex: 'mealType', key: 'mealType', title: '餐次', width: 100 },
  { dataIndex: 'cookDate', key: 'cookDate', title: '做饭日期', width: 120 },
  { dataIndex: 'totalMinutes', key: 'totalMinutes', title: '总耗时', width: 100 },
  { dataIndex: 'rating', key: 'rating', title: '评分', width: 90 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'tags', key: 'tags', title: '标签', width: 180 },
  { key: 'action', title: '操作', width: 190 },
];

const tableColumns = computed(() => [
  ...columns.slice(0, 0),
  { dataIndex: 'dishName', key: 'dishName', title: '菜名', width: 240 },
  { dataIndex: 'cookDate', key: 'cookDate', title: '做饭日期', width: 120 },
  { key: 'scoreTime', title: '评分/耗时', width: 130 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'tags', key: 'tags', title: '标签', width: 170 },
  { fixed: 'right' as const, key: 'action', title: '操作', width: 190 },
]);

const ingredientColumns = [
  { dataIndex: 'name', key: 'name', title: '材料' },
  { dataIndex: 'quantity', key: 'quantity', title: '数量' },
  { dataIndex: 'unit', key: 'unit', title: '单位' },
  { dataIndex: 'remark', key: 'remark', title: '备注' },
];

const stepColumns = [
  { dataIndex: 'stepNo', key: 'stepNo', title: '序号', width: 80 },
  { dataIndex: 'title', key: 'title', title: '标题' },
  { dataIndex: 'description', key: 'description', title: '描述' },
  { dataIndex: 'durationMinutes', key: 'durationMinutes', title: '耗时', width: 100 },
];

const groupedDetailImages = computed(() => {
  const images = currentDetail.value?.images || [];
  return imageTypeOptions
    .map((type) => ({
      ...type,
      images: images.filter((image) => image.imageType === type.value),
    }))
    .filter((group) => group.images.length > 0);
});

const statisticsOverview = computed(
  () =>
    statisticsData.value?.overview || {
      averageRating: 0,
      averageTotalMinutes: 0,
      monthCount: 0,
      totalCount: 0,
      toImproveCount: 0,
      worthRedoCount: 0,
    },
);

const statisticsCards = computed(() => [
  { label: '总记录', value: statisticsOverview.value.totalCount },
  { label: '本月做饭', value: statisticsOverview.value.monthCount },
  { label: '平均评分', value: statisticsOverview.value.averageRating || 0 },
  { label: '平均耗时', suffix: '分钟', value: statisticsOverview.value.averageTotalMinutes || 0 },
  { label: '值得复做', value: statisticsOverview.value.worthRedoCount },
  { label: '待优化', value: statisticsOverview.value.toImproveCount },
]);

const overviewCards = computed(() => [
  { label: '本月做饭', suffix: '次', value: statisticsOverview.value.monthCount },
  { label: '平均评分', value: statisticsOverview.value.averageRating || 0 },
  { label: '平均耗时', suffix: '分钟', value: statisticsOverview.value.averageTotalMinutes || 0 },
  { label: '待优化菜品', suffix: '道', value: statisticsOverview.value.toImproveCount },
]);

const rules: Record<string, Rule[]> = {
  dishName: [{ message: '请输入菜名', required: true, trigger: 'blur' }],
};

const modalTitle = computed(() =>
  formMode.value === 'add' ? '新增美食记录' : '编辑美食记录',
);

const computedTotalMinutes = computed(() => {
  const prep = Number(formState.value.prepMinutes || 0);
  const cook = Number(formState.value.cookMinutes || 0);
  return prep + cook || undefined;
});

const normalizeTags = (tags?: string) =>
  (tags || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const visibleTags = (tags?: string) => normalizeTags(tags).slice(0, 3);

const hiddenTags = (tags?: string) => normalizeTags(tags).slice(3);

const visibleMobileTags = (tags?: string) => normalizeTags(tags).slice(0, 2);

const hiddenMobileTags = (tags?: string) => normalizeTags(tags).slice(2);

const tagTooltip = (tags?: string) => normalizeTags(tags).join('、');

const getStatusMeta = (status?: string) =>
  statusOptions.find((item) => item.value === status) || defaultStatusOption;

const resetMobileFormPanels = () => {
  mobileFormActivePanels.basic = true;
  mobileFormActivePanels.images = false;
  mobileFormActivePanels.ingredients = false;
  mobileFormActivePanels.review = false;
  mobileFormActivePanels.steps = false;
  mobileFormActivePanels.time = false;
};

const toggleMobileFormPanel = (section: MobileFormSection) => {
  if (section === 'basic') return;
  mobileFormActivePanels[section] = !mobileFormActivePanels[section];
};

const formSectionSummary = (section: MobileFormSection) => {
  const ingredientsCount = formState.value.ingredients?.length || 0;
  const stepsCount = formState.value.steps?.length || 0;
  const imagesCount = formImages.value.length;

  const summaryMap: Record<MobileFormSection, string> = {
    basic: '菜名、分类、餐次、日期、状态',
    images:
      formMode.value === 'edit' && formState.value.id
        ? `${imagesCount} 张图片`
        : '保存后可编辑图片',
    ingredients: ingredientsCount > 0 ? `${ingredientsCount} 项材料` : '可先留空',
    review: '难度、评分、总结和复盘',
    steps: stepsCount > 0 ? `${stepsCount} 个步骤` : '可先留空',
    time: computedTotalMinutes.value ? `预计 ${computedTotalMinutes.value} 分钟` : '备菜、烹饪、总耗时',
  };

  return summaryMap[section];
};

const getMobileCardMeta = (record: FoodRecord) => {
  const pieces = [
    `评分 ${record.rating ?? '—'}`,
    `${record.totalMinutes || '—'} 分钟`,
    `${normalizeTags(record.tags).length} 个标签`,
  ];
  return pieces.join(' · ');
};

const selectMealType = (value: string) => {
  formState.value.mealType = formState.value.mealType === value ? undefined : value;
};

const selectStatus = (value: FoodRecordStatus) => {
  formState.value.status = value;
};

const detailNumberFields = new Set<DetailEditableField>([
  'cookMinutes',
  'prepMinutes',
  'rating',
  'totalMinutes',
]);

const detailTextareaFields = new Set<DetailEditableField>([
  'briefSummary',
  'nextImprove',
  'nextTrySuggestion',
  'problems',
  'summary',
  'tasteDescription',
]);

const resetDetailInlineEdit = () => {
  detailEditingField.value = null;
  detailFieldDraft.value = '';
  detailIngredientEditingCell.value = null;
  detailIngredientDraft.value = '';
  detailStepEditingCell.value = null;
  detailStepDraft.value = '';
};

const getDetailFieldValue = (field: DetailEditableField) =>
  currentDetail.value?.record[field];

const beginDetailInlineEdit = (field: DetailEditableField) => {
  if (!currentDetail.value || detailInlineSaving.value) return;
  detailEditingField.value = field;
  detailFieldDraft.value = getDetailFieldValue(field);
};

const cancelDetailInlineEdit = () => {
  resetDetailInlineEdit();
};

const buildInlineDetailPayload = (field: DetailEditableField): FoodRecordSavePayload | null => {
  const detail = currentDetail.value;
  if (!detail) return null;

  const nextRecord: FoodRecord = {
    ...detail.record,
  };
  (nextRecord as Record<string, unknown>)[field] = detailFieldDraft.value;

  if (field === 'dishName') {
    nextRecord.dishName = String(detailFieldDraft.value || '').trim();
    if (!nextRecord.dishName) {
      message.warning('菜名不能为空');
      return null;
    }
  }

  if (detailNumberFields.has(field)) {
    const value = detailFieldDraft.value;
    (nextRecord as Record<string, unknown>)[field] =
      value === undefined || value === null || value === '' ? undefined : Number(value);
  }

  return {
    ...nextRecord,
    ingredients: (detail.ingredients || [])
      .filter((item) => item.name?.trim())
      .map((item, index) => ({
        ...item,
        name: item.name.trim(),
        sortOrder: index + 1,
      })),
    steps: (detail.steps || []).map((item, index) => ({
      ...item,
      sortOrder: index + 1,
      stepNo: item.stepNo || index + 1,
    })),
  };
};

const saveDetailInlineField = async (field: DetailEditableField) => {
  if (!currentDetail.value || detailEditingField.value !== field || detailInlineSaving.value) return;

  const payload = buildInlineDetailPayload(field);
  if (!payload) return;

  detailInlineSaving.value = true;
  try {
    const saved = await updateFoodRecord(payload);
    currentDetail.value = {
      ...saved,
      images: saved.images || currentDetail.value.images,
    };
    resetDetailInlineEdit();
    await loadData();
    await refreshStatisticsAfterMutation();
    message.success('保存成功');
  } catch {
    message.error('保存失败');
  } finally {
    detailInlineSaving.value = false;
  }
};

const handleDetailInlineBlur = (field: DetailEditableField) => {
  if (detailEditingField.value !== field) return;
  void saveDetailInlineField(field);
};

const handleDetailInlineKeydown = (event: KeyboardEvent, field: DetailEditableField) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelDetailInlineEdit();
    return;
  }

  if (
    event.key === 'Enter' &&
    (!detailTextareaFields.has(field) || event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault();
    void saveDetailInlineField(field);
  }
};

const formatInlineBoolean = (value?: boolean) => {
  if (value === undefined) return '—';
  return value ? '是' : '否';
};

const normalizeDetailIngredients = (items: FoodRecordIngredient[]) =>
  items
    .filter((item) => item.name?.trim())
    .map((item, index) => ({
      ...item,
      name: item.name.trim(),
      sortOrder: index + 1,
    }));

const normalizeDetailSteps = (items: FoodRecordStep[]) =>
  items.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    stepNo: item.stepNo || index + 1,
  }));

const buildDetailPayloadWithLists = (
  ingredients: FoodRecordIngredient[],
  steps: FoodRecordStep[],
): FoodRecordSavePayload | null => {
  const detail = currentDetail.value;
  if (!detail) return null;

  return {
    ...detail.record,
    ingredients: normalizeDetailIngredients(ingredients),
    steps: normalizeDetailSteps(steps),
  };
};

const applySavedDetail = async (saved: FoodRecordDetail) => {
  currentDetail.value = {
    ...saved,
    images: saved.images || currentDetail.value?.images || [],
  };
  await loadData();
  await refreshStatisticsAfterMutation();
  message.success('保存成功');
};

const beginIngredientInlineEdit = (
  index: number,
  field: DetailIngredientField,
  record: FoodRecordIngredient,
) => {
  if (detailInlineSaving.value) return;
  detailEditingField.value = null;
  detailStepEditingCell.value = null;
  detailStepDraft.value = '';
  detailIngredientEditingCell.value = { field, index };
  detailIngredientDraft.value = String(record[field] ?? '');
};

const saveIngredientInlineCell = async (index: number, field: DetailIngredientField) => {
  const detail = currentDetail.value;
  const editing = detailIngredientEditingCell.value;
  if (!detail || !editing || editing.index !== index || editing.field !== field || detailInlineSaving.value) {
    return;
  }

  const ingredients = [...(detail.ingredients || [])];
  const target = ingredients[index];
  if (!target) return;

  const nextValue = detailIngredientDraft.value.trim();
  if (field === 'name' && !nextValue) {
    message.warning('材料名称不能为空');
    return;
  }

  ingredients[index] = {
    ...target,
    [field]: nextValue || undefined,
  };

  const payload = buildDetailPayloadWithLists(ingredients, detail.steps || []);
  if (!payload) return;

  detailInlineSaving.value = true;
  try {
    const saved = await updateFoodRecord(payload);
    resetDetailInlineEdit();
    await applySavedDetail(saved);
  } catch {
    message.error('保存失败');
  } finally {
    detailInlineSaving.value = false;
  }
};

const handleIngredientInlineBlur = (index: number, field: DetailIngredientField) => {
  void saveIngredientInlineCell(index, field);
};

const handleIngredientInlineKeydown = (
  event: KeyboardEvent,
  index: number,
  field: DetailIngredientField,
) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelDetailInlineEdit();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    void saveIngredientInlineCell(index, field);
  }
};

const beginStepInlineEdit = (
  index: number,
  field: DetailStepField,
  record: FoodRecordStep,
) => {
  if (detailInlineSaving.value) return;
  detailEditingField.value = null;
  detailIngredientEditingCell.value = null;
  detailIngredientDraft.value = '';
  detailStepEditingCell.value = { field, index };
  detailStepDraft.value = record[field] ?? '';
};

const saveStepInlineCell = async (index: number, field: DetailStepField) => {
  const detail = currentDetail.value;
  const editing = detailStepEditingCell.value;
  if (!detail || !editing || editing.index !== index || editing.field !== field || detailInlineSaving.value) {
    return;
  }

  const steps = [...(detail.steps || [])];
  const target = steps[index];
  if (!target) return;

  const nextValue = detailStepDraft.value;
  const nextStep = { ...target };
  if (field === 'durationMinutes' || field === 'stepNo') {
    nextStep[field] = nextValue === undefined || nextValue === '' ? undefined : Number(nextValue);
  } else {
    nextStep[field] = String(nextValue || '').trim() || undefined;
  }
  steps[index] = nextStep;

  const payload = buildDetailPayloadWithLists(detail.ingredients || [], steps);
  if (!payload) return;

  detailInlineSaving.value = true;
  try {
    const saved = await updateFoodRecord(payload);
    resetDetailInlineEdit();
    await applySavedDetail(saved);
  } catch {
    message.error('保存失败');
  } finally {
    detailInlineSaving.value = false;
  }
};

const handleStepInlineBlur = (index: number, field: DetailStepField) => {
  void saveStepInlineCell(index, field);
};

const handleStepInlineKeydown = (
  event: KeyboardEvent,
  index: number,
  field: DetailStepField,
) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelDetailInlineEdit();
    return;
  }

  if (
    event.key === 'Enter' &&
    (field !== 'description' || event.ctrlKey || event.metaKey)
  ) {
    event.preventDefault();
    void saveStepInlineCell(index, field);
  }
};

const getCardStatusStyle = (status?: FoodRecordStatus) => {
  const styleMap: Record<FoodRecordStatus, Record<string, string>> = {
    archived: {
      '--food-status-accent-rgb': '22 119 255',
      '--food-status-bg-rgb': '22 119 255',
      '--food-status-border': 'rgb(145 202 255 / 0.78)',
      '--food-status-border-hover': 'rgb(22 119 255 / 0.58)',
      '--food-status-shadow-rgb': '22 119 255',
    },
    done: {
      '--food-status-accent-rgb': '34 197 94',
      '--food-status-bg-rgb': '34 197 94',
      '--food-status-border': 'rgb(187 247 208 / 0.82)',
      '--food-status-border-hover': 'rgb(34 197 94 / 0.55)',
      '--food-status-shadow-rgb': '34 197 94',
    },
    draft: {
      '--food-status-accent-rgb': '100 116 139',
      '--food-status-bg-rgb': '100 116 139',
      '--food-status-border': 'rgb(203 213 225 / 0.88)',
      '--food-status-border-hover': 'rgb(100 116 139 / 0.46)',
      '--food-status-shadow-rgb': '100 116 139',
    },
    to_improve: {
      '--food-status-accent-rgb': '249 115 22',
      '--food-status-bg-rgb': '249 115 22',
      '--food-status-border': 'rgb(254 215 170 / 0.95)',
      '--food-status-border-hover': 'rgb(249 115 22 / 0.7)',
      '--food-status-shadow-rgb': '249 115 22',
    },
  };

  return styleMap[status || 'draft'];
};

const buildQuery = () => ({
  category: filters.category,
  endDate: filters.endDate?.format('YYYY-MM-DD'),
  keyword: filters.keyword?.trim() || undefined,
  mealType: filters.mealType,
  page: filters.page,
  pageSize: filters.pageSize,
  startDate: filters.startDate?.format('YYYY-MM-DD'),
  status: filters.status,
  tags: filters.tags?.trim() || undefined,
});

const loadData = async () => {
  loading.value = true;
  try {
    const res = await queryFoodRecords(buildQuery());
    tableData.value = res?.items || [];
    total.value = Number(res?.total || 0);
  } finally {
    loading.value = false;
  }
};

const renderNameCountPie = (
  renderer: typeof renderCategoryChart,
  title: string,
  data: FoodRecordStatisticsNameCount[] = [],
) => {
  renderer(() => ({
    legend: {
      bottom: 0,
      type: 'scroll',
    },
    series: [
      {
        avoidLabelOverlap: true,
        data: data.map((item) => ({ name: item.name, value: item.count })),
        itemStyle: {
          borderColor: '#fff',
          borderRadius: 6,
          borderWidth: 2,
        },
        name: title,
        radius: ['42%', '72%'],
        type: 'pie',
      },
    ],
    tooltip: {
      trigger: 'item',
    },
  }));
};

const renderStatisticsCharts = async () => {
  await nextTick();
  const data = statisticsData.value;
  if (!data) return;
  renderTrendChart(() => ({
    grid: {
      bottom: 36,
      left: 38,
      right: 18,
      top: 28,
    },
    series: [
      {
        barMaxWidth: 28,
        data: data.frequencyTrend.map((item) => item.count),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: '#1677ff',
        },
        name: '做饭次数',
        type: 'bar',
      },
    ],
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      axisLabel: {
        interval: 0,
        rotate: data.frequencyTrend.length > 6 ? 30 : 0,
      },
      data: data.frequencyTrend.map((item) => item.label),
      type: 'category',
    },
    yAxis: {
      minInterval: 1,
      type: 'value',
    },
  }));
  renderNameCountPie(renderCategoryChart, '分类分布', data.categoryDistribution);
  renderNameCountPie(renderMealTypeChart, '餐次分布', data.mealTypeDistribution);
};

const loadStatistics = async () => {
  statisticsLoading.value = true;
  try {
    statisticsData.value = await getFoodRecordStatistics();
    await renderStatisticsCharts();
  } finally {
    statisticsLoading.value = false;
  }
};

const loadOverview = async () => {
  overviewLoading.value = true;
  try {
    statisticsData.value = await getFoodRecordStatistics();
  } finally {
    overviewLoading.value = false;
  }
};

const refreshStatisticsAfterMutation = async () => {
  await loadOverview();
  if (activeTab.value === 'statistics') {
    await loadStatistics();
  }
};

const revokeImageUrls = () => {
  Object.values(imagePreviewMap.value).forEach((url) => URL.revokeObjectURL(url));
  imagePreviewMap.value = {};
};

const loadImagePreviews = async (images?: FoodRecordImage[]) => {
  revokeImageUrls();
  const nextMap: Record<string, string> = {};
  for (const image of images || []) {
    if (!image.id) continue;
    try {
      const blob = await getFoodRecordImageBlob(image.id);
      nextMap[image.id] = URL.createObjectURL(blob);
    } catch {
      // Ignore broken previews; metadata can still be managed.
    }
  }
  imagePreviewMap.value = nextMap;
};

const resetFilters = () => {
  filters.category = undefined;
  filters.endDate = undefined;
  filters.keyword = '';
  filters.mealType = undefined;
  filters.page = 1;
  filters.startDate = undefined;
  filters.status = undefined;
  filters.tags = '';
  loadData();
};

const handleSearch = () => {
  filters.page = 1;
  loadData();
};

const openDetail = async (record: any) => {
  const id = record?.id ? String(record.id) : '';
  if (!id) return;
  detailOpen.value = true;
  detailLoading.value = true;
  resetDetailInlineEdit();
  try {
    currentDetail.value = await getFoodRecordDetail(id);
    await loadImagePreviews(currentDetail.value?.images);
  } finally {
    detailLoading.value = false;
  }
};

const openSummaryDetail = (record: FoodRecordStatisticsSummary) => {
  openDetail({ id: record.id });
};

const openAdd = () => {
  formMode.value = 'add';
  formState.value = emptyForm();
  formImages.value = [];
  uploadCaption.value = '';
  uploadImageType.value = 'finished';
  resetMobileFormPanels();
  formOpen.value = true;
};

const detailToForm = (detail: FoodRecordDetail): FoodRecordFormState => ({
  ...detail.record,
  cookDate: detail.record.cookDate ? dayjs(detail.record.cookDate) : undefined,
  ingredients: [...(detail.ingredients || [])],
  steps: [...(detail.steps || [])],
});

const openEdit = async (record?: any) => {
  const id = record?.id ? String(record.id) : '';
  const target = id
    ? await getFoodRecordDetail(id)
    : currentDetail.value;
  if (!target) return;
  formMode.value = 'edit';
  formState.value = detailToForm(target);
  formImages.value = [...(target.images || [])];
  uploadCaption.value = '';
  uploadImageType.value = 'finished';
  resetMobileFormPanels();
  await loadImagePreviews(formImages.value);
  detailOpen.value = false;
  formOpen.value = true;
};

const buildPayload = (): FoodRecordSavePayload => ({
  ...formState.value,
  cookDate: formState.value.cookDate?.format('YYYY-MM-DD'),
  dishName: formState.value.dishName.trim(),
  ingredients: (formState.value.ingredients || [])
    .filter((item) => item.name?.trim())
    .map((item, index) => ({
      ...item,
      name: item.name.trim(),
      sortOrder: index + 1,
    })),
  steps: (formState.value.steps || []).map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    stepNo: item.stepNo || index + 1,
  })),
  totalMinutes: formState.value.totalMinutes || computedTotalMinutes.value,
});

const submitForm = async () => {
  await formRef.value?.validate();
  formLoading.value = true;
  try {
    const payload = buildPayload();
    const saved =
      formMode.value === 'add'
        ? await saveFoodRecord(payload)
        : await updateFoodRecord(payload);
    message.success('保存成功');
    formOpen.value = false;
    await loadData();
    await refreshStatisticsAfterMutation();
    currentDetail.value = saved;
  } finally {
    formLoading.value = false;
  }
};

const handleDelete = async (record: any) => {
  const id = record?.id ? String(record.id) : '';
  if (!id) return;
  await deleteFoodRecord(id);
  message.success('删除成功');
  await loadData();
  await refreshStatisticsAfterMutation();
};

const refreshFormImages = async () => {
  if (!formState.value.id) return;
  const detail = await getFoodRecordDetail(formState.value.id);
  currentDetail.value = detail;
  formImages.value = [...(detail.images || [])];
  await loadImagePreviews(formImages.value);
};

const beforeUploadImage = (file: File) => {
  uploadImage(file);
  return false;
};

const uploadImage = async (file: File) => {
  if (!formState.value.id) {
    message.warning('请先保存美食记录，再上传图片');
    return;
  }
  imageUploading.value = true;
  try {
    const data = new FormData();
    data.append('recordId', String(formState.value.id));
    data.append('imageType', uploadImageType.value);
    data.append('caption', uploadCaption.value || '');
    data.append('file', file);
    await uploadFoodRecordImage(data);
    uploadCaption.value = '';
    message.success('图片上传成功');
    await refreshFormImages();
  } finally {
    imageUploading.value = false;
  }
};

const saveImageMeta = async (image: FoodRecordImage) => {
  if (!image.id) return;
  await updateFoodRecordImage({
    caption: image.caption,
    id: image.id,
    imageType: image.imageType,
    sortOrder: image.sortOrder,
  });
  message.success('图片信息已保存');
  await refreshFormImages();
};

const deleteImage = async (image: FoodRecordImage) => {
  if (!image.id) return;
  await deleteFoodRecordImage(image.id);
  message.success('图片已删除');
  await refreshFormImages();
};

const moveImage = async (index: number, direction: -1 | 1) => {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= formImages.value.length) return;
  const [item] = formImages.value.splice(index, 1);
  if (!item) return;
  formImages.value.splice(targetIndex, 0, item);
  formImages.value.forEach((image, itemIndex) => {
    image.sortOrder = itemIndex;
  });
  await sortFoodRecordImages({
    items: formImages.value
      .filter((image): image is FoodRecordImage & { id: string } => Boolean(image.id))
      .map((image) => ({
        id: image.id,
        sortOrder: image.sortOrder || 0,
      })),
  });
  await refreshFormImages();
};

const addIngredient = () => {
  formState.value.ingredients = [
    ...(formState.value.ingredients || []),
    { name: '', quantity: '', remark: '', unit: '' },
  ];
};

const removeIngredient = (index: number) => {
  formState.value.ingredients?.splice(index, 1);
};

const addStep = () => {
  const nextNo = (formState.value.steps?.length || 0) + 1;
  formState.value.steps = [
    ...(formState.value.steps || []),
    { description: '', durationMinutes: undefined, stepNo: nextNo, title: '' },
  ];
};

const removeStep = (index: number) => {
  formState.value.steps?.splice(index, 1);
};

const moveStep = (index: number, direction: -1 | 1) => {
  const steps = formState.value.steps || [];
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= steps.length) return;
  const [item] = steps.splice(index, 1);
  if (!item) return;
  steps.splice(targetIndex, 0, item);
  steps.forEach((step, itemIndex) => {
    step.stepNo = itemIndex + 1;
  });
};

onMounted(() => {
  loadData();
  loadOverview();
});

watch(activeTab, (tab) => {
  if (tab !== 'statistics') {
    return;
  }
  if (!statisticsData.value) {
    loadStatistics();
    return;
  }
  renderStatisticsCharts();
});

onBeforeUnmount(() => {
  revokeImageUrls();
});
</script>

<template>
  <div class="food-record-page">
    <div class="page-header">
      <div class="page-title-block">
        <h1>美食</h1>
        <p>记录做饭过程、评价和复盘</p>
      </div>
      <div class="legacy-title">
        <h1>美食记录</h1>
        <p>记录每次做饭的过程、评价和复盘</p>
      </div>
    </div>

    <Spin :spinning="overviewLoading">
      <div class="overview-cards">
        <Card v-for="item in overviewCards" :key="item.label" size="small">
          <div class="overview-card-label">{{ item.label }}</div>
          <div class="overview-card-value">
            {{ item.value }}
            <span v-if="item.suffix">{{ item.suffix }}</span>
          </div>
        </Card>
      </div>
    </Spin>

    <Tabs v-model:active-key="activeTab" class="content-tabs">
      <TabPane key="list" tab="记录列表">
    <div class="filter-bar">
      <Input
        v-model:value="filters.keyword"
        allow-clear
        class="filter-item"
        placeholder="菜名关键词"
        @press-enter="handleSearch"
      />
      <Select
        v-model:value="filters.category"
        allow-clear
        class="filter-item"
        placeholder="分类"
      >
        <SelectOption v-for="item in categoryOptions" :key="item" :value="item">
          {{ item }}
        </SelectOption>
      </Select>
      <Select
        v-model:value="filters.mealType"
        allow-clear
        class="filter-item"
        placeholder="餐次"
      >
        <SelectOption v-for="item in mealTypeOptions" :key="item" :value="item">
          {{ item }}
        </SelectOption>
      </Select>
      <Select
        v-model:value="filters.status"
        allow-clear
        class="filter-item"
        placeholder="状态"
      >
        <SelectOption
          v-for="item in statusOptions"
          :key="item.value"
          :value="item.value"
        >
          {{ item.label }}
        </SelectOption>
      </Select>
      <DatePicker
        v-model:value="filters.startDate"
        class="date-item"
        placeholder="开始日期"
      />
      <DatePicker
        v-model:value="filters.endDate"
        class="date-item"
        placeholder="结束日期"
      />
      <Input
        v-model:value="filters.tags"
        allow-clear
        class="filter-item"
        placeholder="标签"
        @press-enter="handleSearch"
      />
      <Button type="primary" @click="handleSearch">
        <template #icon><SearchOutlined /></template>
        搜索
      </Button>
      <Button @click="resetFilters">重置</Button>
    </div>

    <div class="records-panel">
      <div class="records-toolbar">
        <div>
          <h2>美食记录</h2>
          <span>共 {{ total }} 条</span>
        </div>
        <Space>
          <Button :type="viewMode === 'card' ? 'primary' : 'default'" @click="viewMode = 'card'">
            卡片模式
          </Button>
          <Button :type="viewMode === 'table' ? 'primary' : 'default'" @click="viewMode = 'table'">
            表格模式
          </Button>
        </Space>
      </div>

      <Spin v-if="viewMode === 'card'" :spinning="loading">
        <div v-if="tableData.length > 0" class="record-card-grid">
          <article
            v-for="record in tableData"
            :key="record.id"
            class="food-card"
            :class="{ 'is-to-improve': record.status === 'to_improve' }"
            :style="getCardStatusStyle(record.status)"
          >
            <div class="food-card-header">
              <button class="food-card-title" type="button" @click="openDetail(record)">
                {{ record.dishName }}
              </button>
              <Tag :color="getStatusMeta(record.status).color">
                {{ getStatusMeta(record.status).label }}
              </Tag>
            </div>

            <div class="food-card-meta">
              <span>{{ record.cookDate || '—' }}</span>
              <span>{{ record.category || '未分类' }}</span>
              <span>{{ record.mealType || '未标记餐次' }}</span>
            </div>

            <div class="food-card-mobile-layer">
              <span>{{ getMobileCardMeta(record) }}</span>
              <div class="food-card-mobile-tags">
                <Tag v-for="tag in visibleMobileTags(record.tags)" :key="tag">
                  {{ tag }}
                </Tag>
                <Tooltip v-if="hiddenMobileTags(record.tags).length > 0" :title="tagTooltip(record.tags)">
                  <Tag>+{{ hiddenMobileTags(record.tags).length }}</Tag>
                </Tooltip>
              </div>
            </div>

            <div class="food-card-stats">
              <div>
                <strong>{{ record.rating ?? '—' }}</strong>
                <span>评分</span>
              </div>
              <div>
                <strong>{{ record.totalMinutes || '—' }}</strong>
                <span>分钟</span>
              </div>
            </div>

            <p class="food-card-summary">{{ record.briefSummary || record.summary || '暂无总结' }}</p>

            <div class="food-card-tags">
              <Tag v-for="tag in visibleTags(record.tags)" :key="tag">
                {{ tag }}
              </Tag>
              <Tooltip v-if="hiddenTags(record.tags).length > 0" :title="tagTooltip(record.tags)">
                <Tag>+{{ hiddenTags(record.tags).length }}</Tag>
              </Tooltip>
              <span v-if="normalizeTags(record.tags).length === 0" class="muted">暂无标签</span>
            </div>

            <div class="food-card-actions">
              <Button size="small" @click="openDetail(record)">
                <template #icon><EyeOutlined /></template>
                查看
              </Button>
              <Button size="small" @click="openEdit(record)">
                <template #icon><EditOutlined /></template>
                编辑
              </Button>
              <Popconfirm
                title="确定要删除这条美食记录吗？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small">
                  <template #icon><DeleteOutlined /></template>
                  删除
                </Button>
              </Popconfirm>
            </div>
          </article>
        </div>
        <Empty v-else class="card-empty" description="暂无美食记录" />
        <Pagination
          v-if="total > 0"
          v-model:current="filters.page"
          v-model:page-size="filters.pageSize"
          class="card-pagination"
          :show-total="(value: number) => `共 ${value} 条`"
          :total="total"
          show-size-changer
          @change="loadData"
        />
      </Spin>
    </div>

    <div v-if="viewMode === 'table'" class="table-panel">
      <Table
        :columns="tableColumns"
        :data-source="tableData"
        :loading="loading"
        :pagination="{
          current: filters.page,
          pageSize: filters.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value: number) => `共 ${value} 条`,
        }"
        :row-class-name="(record: FoodRecord) => record.status === 'to_improve' ? 'table-row-to-improve' : ''"
        row-key="id"
        :scroll="{ x: 980 }"
        size="middle"
        @change="
          (pagination: any) => {
            filters.page = pagination.current || 1;
            filters.pageSize = pagination.pageSize || 50;
            loadData();
          }
        "
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'dishName'">
            <div class="table-dish-cell">
              <Button type="link" class="dish-link" @click="openDetail(record)">
                {{ record.dishName }}
              </Button>
              <span>{{ record.category || '未分类' }} · {{ record.mealType || '未标记餐次' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'totalMinutes'">
            <span v-if="record.totalMinutes">{{ record.totalMinutes }} 分钟</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'rating'">
            <span v-if="record.rating !== undefined">{{ record.rating }}</span>
            <span v-else class="muted">—</span>
          </template>
          <template v-else-if="column.key === 'scoreTime'">
            <span class="score-time-text">
              {{ record.rating ?? '—' }} 分 · {{ record.totalMinutes || '—' }} 分钟
            </span>
          </template>
          <template v-else-if="column.key === 'status'">
            <Tag :color="getStatusMeta(record.status).color">
              {{ getStatusMeta(record.status).label }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'tags'">
            <Space wrap :size="[4, 4]">
              <Tag v-for="tag in visibleTags(record.tags)" :key="tag">
                {{ tag }}
              </Tag>
              <Tooltip v-if="hiddenTags(record.tags).length > 0" :title="tagTooltip(record.tags)">
                <Tag>+{{ hiddenTags(record.tags).length }}</Tag>
              </Tooltip>
              <span v-if="normalizeTags(record.tags).length === 0" class="muted">
                —
              </span>
            </Space>
          </template>
          <template v-else-if="column.key === 'action'">
            <Space>
              <Button size="small" @click="openDetail(record)">
                <template #icon><EyeOutlined /></template>
                查看
              </Button>
              <Button size="small" @click="openEdit(record)">
                <template #icon><EditOutlined /></template>
                编辑
              </Button>
              <Popconfirm
                title="确定要删除这条美食记录吗？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small">
                  <template #icon><DeleteOutlined /></template>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </div>

      </TabPane>
      <TabPane key="statistics" tab="统计洞察">
        <Spin :spinning="statisticsLoading">
          <div class="statistics-panel">
            <div class="statistics-cards">
              <Card v-for="item in statisticsCards" :key="item.label" size="small">
                <div class="stat-card-label">{{ item.label }}</div>
                <div class="stat-card-value">
                  {{ item.value }}
                  <span v-if="item.suffix">{{ item.suffix }}</span>
                </div>
              </Card>
            </div>

            <div class="chart-grid">
              <Card title="做饭频率" size="small">
                <EchartsUI ref="trendChartRef" height="280px" />
              </Card>
              <Card title="分类分布" size="small">
                <EchartsUI ref="categoryChartRef" height="280px" />
              </Card>
              <Card title="餐次分布" size="small">
                <EchartsUI ref="mealTypeChartRef" height="280px" />
              </Card>
            </div>

            <div class="rank-grid">
              <Card title="常做菜排行" size="small">
                <div v-if="statisticsData?.dishRank?.length" class="rank-list">
                  <div
                    v-for="(item, index) in statisticsData.dishRank"
                    :key="item.name"
                    class="rank-row"
                  >
                    <span>{{ index + 1 }}. {{ item.name }}</span>
                    <Tag color="blue">{{ item.count }} 次</Tag>
                  </div>
                </div>
                <Empty v-else description="暂无数据" />
              </Card>
              <Card title="常用食材排行" size="small">
                <div v-if="statisticsData?.ingredientRank?.length" class="rank-list">
                  <div
                    v-for="(item, index) in statisticsData.ingredientRank"
                    :key="item.name"
                    class="rank-row"
                  >
                    <span>{{ index + 1 }}. {{ item.name }}</span>
                    <Tag color="green">{{ item.count }} 次</Tag>
                  </div>
                </div>
                <Empty v-else description="暂无数据" />
              </Card>
              <Card title="状态分布" size="small">
                <div v-if="statisticsData?.statusDistribution?.length" class="rank-list">
                  <div
                    v-for="item in statisticsData.statusDistribution"
                    :key="item.name"
                    class="rank-row"
                  >
                    <span>{{ getStatusMeta(item.name).label }}</span>
                    <Tag :color="getStatusMeta(item.name).color">{{ item.count }} 条</Tag>
                  </div>
                </div>
                <Empty v-else description="暂无数据" />
              </Card>
            </div>

            <div class="summary-grid">
              <Card title="待优化菜品" size="small">
                <div v-if="statisticsData?.toImproveRecords?.length" class="summary-list">
                  <button
                    v-for="record in statisticsData.toImproveRecords"
                    :key="record.id"
                    class="summary-card"
                    type="button"
                    @click="openSummaryDetail(record)"
                  >
                    <strong>{{ record.dishName }}</strong>
                    <span>{{ record.nextImprove || record.problems || record.summary || '暂无复盘' }}</span>
                  </button>
                </div>
                <Empty v-else description="暂无待优化记录" />
              </Card>
              <Card title="复做提醒" size="small">
                <div v-if="statisticsData?.redoReminders?.length" class="summary-list">
                  <button
                    v-for="record in statisticsData.redoReminders"
                    :key="record.id"
                    class="summary-card"
                    type="button"
                    @click="openSummaryDetail(record)"
                  >
                    <strong>{{ record.dishName }}</strong>
                    <span>
                      {{ record.summary || record.nextTrySuggestion || '值得复做' }}
                    </span>
                  </button>
                </div>
                <Empty v-else description="暂无复做提醒" />
              </Card>
            </div>
          </div>
        </Spin>
      </TabPane>
    </Tabs>

    <Modal
      v-model:open="detailOpen"
      title="美食记录详情"
      :footer="null"
      :width="isMobile ? '96%' : 860"
      @cancel="resetDetailInlineEdit"
    >
      <Spin :spinning="detailLoading">
        <template v-if="currentDetail">
          <div class="detail-title-row">
            <div>
              <Input
                v-if="detailEditingField === 'dishName'"
                v-model:value="detailFieldDraft"
                class="detail-title-input"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('dishName')"
                @keydown="handleDetailInlineKeydown($event, 'dishName')"
              />
              <h2
                v-else
                class="detail-inline-editable detail-title-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('dishName')"
              >
                {{ currentDetail.record.dishName }}
              </h2>
              <Space wrap>
                <Tag :color="getStatusMeta(currentDetail.record.status).color">
                  {{ getStatusMeta(currentDetail.record.status).label }}
                </Tag>
                <Tag v-if="currentDetail.record.category">
                  {{ currentDetail.record.category }}
                </Tag>
                <Tag v-if="currentDetail.record.mealType">
                  {{ currentDetail.record.mealType }}
                </Tag>
              </Space>
            </div>
            <div class="detail-date">{{ currentDetail.record.cookDate || '—' }}</div>
          </div>

          <Descriptions bordered :column="isMobile ? 1 : 3" size="small">
            <DescriptionsItem label="备菜时间">
              <InputNumber
                v-if="detailEditingField === 'prepMinutes'"
                v-model:value="detailFieldDraft"
                class="detail-number-input"
                :disabled="detailInlineSaving"
                :min="0"
                :precision="0"
                autofocus
                @blur="handleDetailInlineBlur('prepMinutes')"
                @keydown="handleDetailInlineKeydown($event, 'prepMinutes')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('prepMinutes')"
              >
                {{ currentDetail.record.prepMinutes || '—' }}
                <span v-if="currentDetail.record.prepMinutes">分钟</span>
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="烹饪时间">
              <InputNumber
                v-if="detailEditingField === 'cookMinutes'"
                v-model:value="detailFieldDraft"
                class="detail-number-input"
                :disabled="detailInlineSaving"
                :min="0"
                :precision="0"
                autofocus
                @blur="handleDetailInlineBlur('cookMinutes')"
                @keydown="handleDetailInlineKeydown($event, 'cookMinutes')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('cookMinutes')"
              >
                {{ currentDetail.record.cookMinutes || '—' }}
                <span v-if="currentDetail.record.cookMinutes">分钟</span>
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="总耗时">
              <InputNumber
                v-if="detailEditingField === 'totalMinutes'"
                v-model:value="detailFieldDraft"
                class="detail-number-input"
                :disabled="detailInlineSaving"
                :min="0"
                :precision="0"
                autofocus
                @blur="handleDetailInlineBlur('totalMinutes')"
                @keydown="handleDetailInlineKeydown($event, 'totalMinutes')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('totalMinutes')"
              >
                {{ currentDetail.record.totalMinutes || '—' }}
                <span v-if="currentDetail.record.totalMinutes">分钟</span>
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="难度">
              <Input
                v-if="detailEditingField === 'difficulty'"
                v-model:value="detailFieldDraft"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('difficulty')"
                @keydown="handleDetailInlineKeydown($event, 'difficulty')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('difficulty')"
              >
                {{ currentDetail.record.difficulty || '—' }}
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="评分">
              <InputNumber
                v-if="detailEditingField === 'rating'"
                v-model:value="detailFieldDraft"
                class="detail-number-input"
                :disabled="detailInlineSaving"
                :max="10"
                :min="0"
                :precision="1"
                autofocus
                @blur="handleDetailInlineBlur('rating')"
                @keydown="handleDetailInlineKeydown($event, 'rating')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('rating')"
              >
                {{ currentDetail.record.rating ?? '—' }}
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="成功程度">
              <Input
                v-if="detailEditingField === 'successLevel'"
                v-model:value="detailFieldDraft"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('successLevel')"
                @keydown="handleDetailInlineKeydown($event, 'successLevel')"
              />
              <span
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('successLevel')"
              >
                {{ currentDetail.record.successLevel || '—' }}
              </span>
            </DescriptionsItem>
            <DescriptionsItem label="标签" :span="isMobile ? 1 : 3">
              <Space wrap>
                <Tag v-for="tag in normalizeTags(currentDetail.record.tags)" :key="tag">
                  {{ tag }}
                </Tag>
                <span v-if="normalizeTags(currentDetail.record.tags).length === 0">—</span>
              </Space>
            </DescriptionsItem>
          </Descriptions>

          <Divider orientation="left">材料清单</Divider>
          <Table
            v-if="currentDetail.ingredients?.length"
            :columns="ingredientColumns"
            :data-source="currentDetail.ingredients"
            :pagination="false"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="['name', 'quantity', 'unit', 'remark'].includes(String(column.key))">
                <Input
                  v-if="
                    detailIngredientEditingCell?.index === index &&
                    detailIngredientEditingCell?.field === column.key
                  "
                  v-model:value="detailIngredientDraft"
                  :disabled="detailInlineSaving"
                  autofocus
                  @blur="handleIngredientInlineBlur(index, column.key as DetailIngredientField)"
                  @keydown="
                    handleIngredientInlineKeydown($event, index, column.key as DetailIngredientField)
                  "
                />
                <span
                  v-else
                  class="detail-inline-editable detail-table-cell-editable"
                  title="双击编辑"
                  @dblclick="
                    beginIngredientInlineEdit(index, column.key as DetailIngredientField, record)
                  "
                >
                  {{ record[column.key as DetailIngredientField] || '—' }}
                </span>
              </template>
            </template>
          </Table>
          <Empty v-else description="暂无材料" />

          <Divider orientation="left">步骤流程</Divider>
          <Table
            v-if="currentDetail.steps?.length"
            :columns="stepColumns"
            :data-source="currentDetail.steps"
            :pagination="false"
            row-key="id"
            size="small"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="['stepNo', 'title', 'description', 'durationMinutes'].includes(String(column.key))">
                <InputNumber
                  v-if="
                    ['stepNo', 'durationMinutes'].includes(String(column.key)) &&
                    detailStepEditingCell?.index === index &&
                    detailStepEditingCell?.field === column.key
                  "
                  v-model:value="detailStepDraft"
                  class="detail-number-input"
                  :disabled="detailInlineSaving"
                  :min="column.key === 'stepNo' ? 1 : 0"
                  :precision="0"
                  autofocus
                  @blur="handleStepInlineBlur(index, column.key as DetailStepField)"
                  @keydown="handleStepInlineKeydown($event, index, column.key as DetailStepField)"
                />
                <Textarea
                  v-else-if="
                    column.key === 'description' &&
                    detailStepEditingCell?.index === index &&
                    detailStepEditingCell?.field === 'description'
                  "
                  v-model:value="detailStepDraft"
                  class="detail-textarea-input"
                  :auto-size="{ minRows: 2, maxRows: 5 }"
                  :disabled="detailInlineSaving"
                  autofocus
                  @blur="handleStepInlineBlur(index, 'description')"
                  @keydown="handleStepInlineKeydown($event, index, 'description')"
                />
                <Input
                  v-else-if="
                    column.key === 'title' &&
                    detailStepEditingCell?.index === index &&
                    detailStepEditingCell?.field === 'title'
                  "
                  v-model:value="detailStepDraft"
                  :disabled="detailInlineSaving"
                  autofocus
                  @blur="handleStepInlineBlur(index, 'title')"
                  @keydown="handleStepInlineKeydown($event, index, 'title')"
                />
                <span
                  v-else
                  class="detail-inline-editable detail-table-cell-editable"
                  title="双击编辑"
                  @dblclick="beginStepInlineEdit(index, column.key as DetailStepField, record)"
                >
                  <template v-if="column.key === 'durationMinutes'">
                    <span v-if="record.durationMinutes">{{ record.durationMinutes }} 分钟</span>
                    <span v-else>—</span>
                  </template>
                  <template v-else>
                    {{ record[column.key as DetailStepField] || '—' }}
                  </template>
                </span>
              </template>
            </template>
          </Table>
          <Empty v-else description="暂无步骤" />

          <Divider orientation="left">评价复盘</Divider>
          <Divider orientation="left">图片区域</Divider>
          <div v-if="groupedDetailImages.length" class="image-groups">
            <div
              v-for="group in groupedDetailImages"
              :key="group.value"
              class="image-group"
            >
              <h3>{{ group.label }}</h3>
              <div class="image-grid">
                <div v-for="image in group.images" :key="image.id" class="image-card">
                  <img
                    v-if="image.id && imagePreviewMap[image.id]"
                    :src="imagePreviewMap[image.id]"
                    :alt="image.caption || group.label"
                  />
                  <div v-else class="image-placeholder">预览失败</div>
                  <p>{{ image.caption || '—' }}</p>
                </div>
              </div>
            </div>
          </div>

          <Divider orientation="left">评价复盘</Divider>
          <div class="review-grid">
            <div>
              <strong>列表总结</strong>
              <Textarea
                v-if="detailEditingField === 'briefSummary'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('briefSummary')"
                @keydown="handleDetailInlineKeydown($event, 'briefSummary')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('briefSummary')"
              >
                {{ currentDetail.record.briefSummary || '—' }}
              </p>
            </div>
            <div>
              <strong>口味描述</strong>
              <Textarea
                v-if="detailEditingField === 'tasteDescription'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('tasteDescription')"
                @keydown="handleDetailInlineKeydown($event, 'tasteDescription')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('tasteDescription')"
              >
                {{ currentDetail.record.tasteDescription || '—' }}
              </p>
            </div>
            <div>
              <strong>问题或不足</strong>
              <Textarea
                v-if="detailEditingField === 'problems'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('problems')"
                @keydown="handleDetailInlineKeydown($event, 'problems')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('problems')"
              >
                {{ currentDetail.record.problems || '—' }}
              </p>
            </div>
            <div>
              <strong>本次总结</strong>
              <Textarea
                v-if="detailEditingField === 'summary'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('summary')"
                @keydown="handleDetailInlineKeydown($event, 'summary')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('summary')"
              >
                {{ currentDetail.record.summary || '—' }}
              </p>
            </div>
            <div>
              <strong>下次改进</strong>
              <Textarea
                v-if="detailEditingField === 'nextImprove'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('nextImprove')"
                @keydown="handleDetailInlineKeydown($event, 'nextImprove')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('nextImprove')"
              >
                {{ currentDetail.record.nextImprove || '—' }}
              </p>
            </div>
            <div>
              <strong>是否值得复做</strong>
              <div v-if="detailEditingField === 'worthRedo'" class="detail-switch-editor">
                <Switch
                  :checked="detailFieldDraft === true"
                  :disabled="detailInlineSaving"
                  checked-children="是"
                  un-checked-children="否"
                  @change="
                    (checked: boolean) => {
                      detailFieldDraft = checked;
                      saveDetailInlineField('worthRedo');
                    }
                  "
                />
                <Button size="small" type="link" @click="cancelDetailInlineEdit">取消</Button>
              </div>
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('worthRedo')"
              >
                {{ formatInlineBoolean(currentDetail.record.worthRedo) }}
              </p>
            </div>
            <div>
              <strong>下次尝试建议</strong>
              <Textarea
                v-if="detailEditingField === 'nextTrySuggestion'"
                v-model:value="detailFieldDraft"
                class="detail-textarea-input"
                :auto-size="{ minRows: 2, maxRows: 5 }"
                :disabled="detailInlineSaving"
                autofocus
                @blur="handleDetailInlineBlur('nextTrySuggestion')"
                @keydown="handleDetailInlineKeydown($event, 'nextTrySuggestion')"
              />
              <p
                v-else
                class="detail-inline-editable"
                title="双击编辑"
                @dblclick="beginDetailInlineEdit('nextTrySuggestion')"
              >
                {{ currentDetail.record.nextTrySuggestion || '—' }}
              </p>
            </div>
          </div>

          <div class="modal-actions">
            <Button
              @click="
                detailOpen = false;
                resetDetailInlineEdit();
              "
            >
              关闭
            </Button>
            <Button type="primary" @click="openEdit()">编辑记录</Button>
          </div>
        </template>
      </Spin>
    </Modal>

    <Modal
      v-model:open="formOpen"
      class="food-form-modal"
      :confirm-loading="formLoading"
      :footer="isMobile ? null : undefined"
      :title="modalTitle"
      :width="isMobile ? '100vw' : 920"
      wrap-class-name="food-form-modal-wrap"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitForm"
    >
      <Form ref="formRef" class="food-form" :model="formState" :rules="rules" layout="vertical">
        <section class="food-form-section">
          <button class="food-form-section-head is-static" type="button">
            <span>基础信息</span>
            <small>{{ formSectionSummary('basic') }}</small>
          </button>
          <div class="food-form-section-body">
            <div class="form-grid">
              <FormItem label="菜名" name="dishName">
                <Input v-model:value="formState.dishName" placeholder="例如：番茄炒蛋" />
              </FormItem>
              <FormItem label="分类">
                <Select
                  v-model:value="formState.category"
                  allow-clear
                  show-search
                  placeholder="选择或输入分类"
                  :options="categoryOptions.map((item) => ({ label: item, value: item }))"
                />
              </FormItem>
              <FormItem label="餐次">
                <Select
                  v-if="!isMobile"
                  v-model:value="formState.mealType"
                  allow-clear
                  placeholder="选择餐次"
                >
                  <SelectOption v-for="item in mealTypeOptions" :key="item" :value="item">
                    {{ item }}
                  </SelectOption>
                </Select>
                <div v-else class="form-chip-group">
                  <button
                    v-for="item in mealTypeOptions"
                    :key="item"
                    class="form-chip"
                    :class="{ 'is-active': formState.mealType === item }"
                    type="button"
                    @click="selectMealType(item)"
                  >
                    {{ item }}
                  </button>
                </div>
              </FormItem>
              <FormItem label="做饭日期">
                <DatePicker v-model:value="formState.cookDate" class="w-full" />
              </FormItem>
              <FormItem label="状态">
                <Select v-if="!isMobile" v-model:value="formState.status">
                  <SelectOption
                    v-for="item in statusOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectOption>
                </Select>
                <div v-else class="form-chip-group">
                  <button
                    v-for="item in statusOptions"
                    :key="item.value"
                    class="form-chip"
                    :class="[
                      `is-${item.value}`,
                      { 'is-active': formState.status === item.value },
                    ]"
                    type="button"
                    @click="selectStatus(item.value)"
                  >
                    {{ item.label }}
                  </button>
                </div>
              </FormItem>
            </div>
          </div>
        </section>

        <section class="food-form-section">
          <button class="food-form-section-head" type="button" @click="toggleMobileFormPanel('time')">
            <span>时间信息</span>
            <small>{{ formSectionSummary('time') }}</small>
            <DownOutlined class="section-arrow" />
          </button>
          <div v-show="!isMobile || mobileFormActivePanels.time" class="food-form-section-body">
            <div class="form-grid">
              <FormItem label="备菜时间（分钟）">
                <InputNumber
                  v-model:value="formState.prepMinutes"
                  class="w-full"
                  :min="0"
                  :precision="0"
                />
              </FormItem>
              <FormItem label="烹饪时间（分钟）">
                <InputNumber
                  v-model:value="formState.cookMinutes"
                  class="w-full"
                  :min="0"
                  :precision="0"
                />
              </FormItem>
              <FormItem label="总耗时（分钟）">
                <InputNumber
                  v-model:value="formState.totalMinutes"
                  class="w-full"
                  :min="0"
                  :placeholder="
                    computedTotalMinutes ? `默认 ${computedTotalMinutes} 分钟` : '可留空'
                  "
                  :precision="0"
                />
              </FormItem>
            </div>
          </div>
        </section>

        <section class="food-form-section">
          <button class="food-form-section-head" type="button" @click="toggleMobileFormPanel('ingredients')">
            <span>材料清单</span>
            <small>{{ formSectionSummary('ingredients') }}</small>
            <DownOutlined class="section-arrow" />
          </button>
          <div v-show="!isMobile || mobileFormActivePanels.ingredients" class="food-form-section-body">
            <div class="editable-list">
              <div
                v-for="(item, index) in formState.ingredients"
                :key="index"
                class="editable-row ingredient-row"
              >
                <Input v-model:value="item.name" placeholder="材料名称" />
                <Input v-model:value="item.quantity" placeholder="数量" />
                <Input v-model:value="item.unit" placeholder="单位" />
                <Input v-model:value="item.remark" placeholder="备注" />
                <Button danger @click="removeIngredient(index)">删除</Button>
              </div>
              <Button block type="dashed" @click="addIngredient">
                <template #icon><PlusOutlined /></template>
                添加材料
              </Button>
            </div>
          </div>
        </section>

        <section class="food-form-section">
          <button class="food-form-section-head" type="button" @click="toggleMobileFormPanel('steps')">
            <span>步骤流程</span>
            <small>{{ formSectionSummary('steps') }}</small>
            <DownOutlined class="section-arrow" />
          </button>
          <div v-show="!isMobile || mobileFormActivePanels.steps" class="food-form-section-body">
            <div class="editable-list">
              <div
                v-for="(item, index) in formState.steps"
                :key="index"
                class="editable-row step-row"
              >
                <InputNumber
                  v-model:value="item.stepNo"
                  class="step-no"
                  :min="1"
                  :precision="0"
                />
                <Input v-model:value="item.title" placeholder="步骤标题" />
                <Textarea
                  v-model:value="item.description"
                  :auto-size="{ minRows: 1, maxRows: 3 }"
                  placeholder="步骤描述"
                />
                <InputNumber
                  v-model:value="item.durationMinutes"
                  class="duration"
                  :min="0"
                  :precision="0"
                  placeholder="分钟"
                />
                <Space>
                  <Button :disabled="index === 0" @click="moveStep(index, -1)">
                    <template #icon><UpOutlined /></template>
                  </Button>
                  <Button
                    :disabled="index === (formState.steps?.length || 0) - 1"
                    @click="moveStep(index, 1)"
                  >
                    <template #icon><DownOutlined /></template>
                  </Button>
                  <Button danger @click="removeStep(index)">删除</Button>
                </Space>
              </div>
              <Button block type="dashed" @click="addStep">
                <template #icon><PlusOutlined /></template>
                添加步骤
              </Button>
            </div>
          </div>
        </section>

        <section class="food-form-section">
          <button class="food-form-section-head" type="button" @click="toggleMobileFormPanel('review')">
            <span>评价复盘</span>
            <small>{{ formSectionSummary('review') }}</small>
            <DownOutlined class="section-arrow" />
          </button>
          <div v-show="!isMobile || mobileFormActivePanels.review" class="food-form-section-body">
            <div class="form-grid">
              <FormItem label="难度">
                <Input v-model:value="formState.difficulty" placeholder="例如：简单/中等/困难" />
              </FormItem>
              <FormItem label="评分">
                <InputNumber
                  v-model:value="formState.rating"
                  class="w-full"
                  :max="10"
                  :min="0"
                  :precision="1"
                />
              </FormItem>
              <FormItem label="成功程度">
                <Input v-model:value="formState.successLevel" placeholder="例如：成功/一般/失败" />
              </FormItem>
              <FormItem label="是否值得复做">
                <Switch
                  v-model:checked="formState.worthRedo"
                  checked-children="是"
                  un-checked-children="否"
                />
              </FormItem>
              <FormItem label="标签">
                <Input v-model:value="formState.tags" placeholder="多个标签用逗号分隔" />
              </FormItem>
            </div>
            <FormItem label="总结">
              <Input v-model:value="formState.briefSummary" placeholder="用于列表展示" />
            </FormItem>
            <FormItem label="口味描述">
              <Textarea
                v-model:value="formState.tasteDescription"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
            </FormItem>
            <FormItem label="问题或不足">
              <Textarea
                v-model:value="formState.problems"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
            </FormItem>
            <FormItem label="本次总结">
              <Textarea
                v-model:value="formState.summary"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
            </FormItem>
            <FormItem label="下次改进">
              <Textarea
                v-model:value="formState.nextImprove"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
            </FormItem>
            <FormItem label="下次尝试建议">
              <Textarea
                v-model:value="formState.nextTrySuggestion"
                :auto-size="{ minRows: 2, maxRows: 5 }"
              />
            </FormItem>
          </div>
        </section>

        <section class="food-form-section">
          <button class="food-form-section-head" type="button" @click="toggleMobileFormPanel('images')">
            <span>图片管理</span>
            <small>{{ formSectionSummary('images') }}</small>
            <DownOutlined class="section-arrow" />
          </button>
          <div v-show="!isMobile || mobileFormActivePanels.images" class="food-form-section-body">
            <div v-if="formMode === 'edit' && formState.id" class="image-manager">
              <div class="image-upload-row">
                <Select v-model:value="uploadImageType" class="image-type-select">
                  <SelectOption
                    v-for="item in imageTypeOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectOption>
                </Select>
                <Input v-model:value="uploadCaption" placeholder="图片说明" />
                <Upload
                  accept="image/*"
                  :before-upload="beforeUploadImage"
                  :show-upload-list="false"
                >
                  <Button :loading="imageUploading">
                    <template #icon><PlusOutlined /></template>
                    上传图片
                  </Button>
                </Upload>
              </div>

              <div v-if="formImages.length" class="image-edit-list">
                <div
                  v-for="(image, index) in formImages"
                  :key="image.id"
                  class="image-edit-card"
                >
                  <img
                    v-if="image.id && imagePreviewMap[image.id]"
                    :src="imagePreviewMap[image.id]"
                    :alt="image.caption || '美食图片'"
                  />
                  <div v-else class="image-placeholder">预览失败</div>
                  <Select v-model:value="image.imageType">
                    <SelectOption
                      v-for="item in imageTypeOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ item.label }}
                    </SelectOption>
                  </Select>
                  <Input v-model:value="image.caption" placeholder="图片说明" />
                  <Space>
                    <Button :disabled="index === 0" @click="moveImage(index, -1)">
                      <template #icon><UpOutlined /></template>
                    </Button>
                    <Button
                      :disabled="index === formImages.length - 1"
                      @click="moveImage(index, 1)"
                    >
                      <template #icon><DownOutlined /></template>
                    </Button>
                    <Button @click="saveImageMeta(image)">保存</Button>
                    <Popconfirm
                      title="确定删除这张图片吗？"
                      ok-text="删除"
                      cancel-text="取消"
                      @confirm="deleteImage(image)"
                    >
                      <Button danger>删除</Button>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
              <Empty v-else description="暂无图片" />
            </div>
            <div v-else class="image-save-tip">请先保存美食记录，再编辑图片。</div>
          </div>
        </section>

        <div v-if="isMobile" class="mobile-form-footer">
          <Button block @click="formOpen = false">取消</Button>
          <Button block type="primary" :loading="formLoading" @click="submitForm">保存</Button>
        </div>
      </Form>
    </Modal>

    <GlobalFloatBtn @click="openAdd" />
  </div>
</template>

<style scoped>
.food-record-page {
  min-height: 100%;
  padding: 24px;
  background: #f4f7fb;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1400px;
  margin: 0 auto 18px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: #111827;
}

.page-header p {
  margin: 6px 0 0;
  color: #6b7280;
}

.legacy-title {
  display: none;
}

.filter-bar,
.records-panel,
.table-panel,
.statistics-panel {
  max-width: 1400px;
  margin: 0 auto;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  max-width: 1400px;
  margin: 0 auto 16px;
}

.overview-card-label {
  color: #6b7280;
}

.overview-card-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 800;
  color: #111827;
}

.overview-card-value span {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 16px;
  margin-bottom: 16px;
}

.filter-item {
  width: 180px;
}

.date-item {
  width: 150px;
}

.table-panel {
  padding: 10px;
}

.records-panel {
  padding: 16px;
  margin-bottom: 16px;
}

.records-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.records-toolbar h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.records-toolbar span {
  display: inline-block;
  margin-top: 4px;
  color: #6b7280;
}

.record-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap: 14px;
}

.food-card {
  display: flex;
  flex-direction: column;
  position: relative;
  min-width: 0;
  min-height: 240px;
  padding: 18px;
  overflow: hidden;
  background:
    radial-gradient(circle at 88% 12%, rgb(var(--food-status-bg-rgb) / 0.08) 0%, transparent 42%),
    radial-gradient(circle at 8% 92%, rgb(16 185 129 / 0.06) 0%, transparent 48%),
    linear-gradient(135deg, rgb(255 255 255 / 0.95) 0%, #f8fafc 100%);
  border: 1px solid var(--food-status-border, rgb(226 232 240 / 0.9));
  border-radius: 8px;
  box-shadow:
    inset 3px 0 0 rgb(var(--food-status-accent-rgb) / 0.78),
    0 10px 24px rgb(15 23 42 / 0.04),
    0 10px 24px rgb(var(--food-status-shadow-rgb) / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.78);
  transition:
    transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    box-shadow 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    border-color 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    background 0.32s cubic-bezier(0.25, 0.8, 0.25, 1);
  will-change: transform, box-shadow;
}

.food-card::before {
  position: absolute;
  inset: -45%;
  z-index: 0;
  pointer-events: none;
  content: '';
  background: radial-gradient(
    circle at 20% 12%,
    rgb(var(--food-status-accent-rgb) / 0.12) 0%,
    transparent 56%
  );
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
    transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.food-card::after {
  position: absolute;
  top: -70%;
  left: -85%;
  z-index: 0;
  width: 165%;
  height: 220%;
  pointer-events: none;
  content: '';
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgb(255 255 255 / 0.56) 44%,
    rgb(255 255 255 / 0.08) 57%,
    transparent 72%
  );
  opacity: 0;
  transform: translateX(-30%) rotate(10deg);
  transition:
    opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
    transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.food-card.is-to-improve {
  background:
    radial-gradient(circle at 88% 12%, rgb(249 115 22 / 0.14) 0%, transparent 44%),
    linear-gradient(135deg, #fff7ed 0%, #fff 48%, #f8fafc 100%);
  box-shadow:
    inset 3px 0 0 #f97316,
    0 10px 24px rgb(249 115 22 / 0.1),
    inset 0 1px 0 rgb(255 255 255 / 0.78);
}

.food-card:hover {
  background:
    radial-gradient(circle at 86% 10%, rgb(var(--food-status-bg-rgb) / 0.13) 0%, transparent 44%),
    radial-gradient(circle at 10% 92%, rgb(16 185 129 / 0.08) 0%, transparent 48%),
    linear-gradient(135deg, rgb(255 255 255 / 0.98) 0%, #f8fafc 100%);
  border-color: var(--food-status-border-hover, rgb(59 130 246 / 0.26));
  box-shadow:
    inset 3px 0 0 rgb(var(--food-status-accent-rgb) / 0.92),
    0 18px 40px rgb(15 23 42 / 0.12),
    0 18px 40px rgb(var(--food-status-shadow-rgb) / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.86);
  transform: translateY(-6px);
}

.food-card.is-to-improve:hover {
  background:
    radial-gradient(circle at 88% 12%, rgb(249 115 22 / 0.18) 0%, transparent 44%),
    linear-gradient(135deg, #fff7ed 0%, #fff 48%, #f8fafc 100%);
  box-shadow:
    inset 3px 0 0 #f97316,
    0 18px 40px rgb(249 115 22 / 0.22),
    0 18px 40px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.86);
}

.food-card:hover::before {
  opacity: 1;
  transform: scale(1);
}

.food-card:hover::after {
  opacity: 1;
  transform: translateX(85%) rotate(10deg);
}

.food-card-header {
  display: flex;
  position: relative;
  z-index: 1;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.food-card-title {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.food-card-meta,
.food-card-tags {
  display: flex;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
  gap: 8px;
  margin-top: 12px;
}

.food-card-meta span {
  padding: 2px 8px;
  color: #475569;
  background: #f1f5f9;
  border-radius: 999px;
}

.food-card-mobile-layer {
  display: none;
}

.food-card-stats {
  display: grid;
  position: relative;
  z-index: 1;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.food-card-stats div {
  padding: 10px;
  background: #fff;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.food-card-stats strong,
.food-card-stats span {
  display: block;
}

.food-card-stats strong {
  font-size: 22px;
  color: #111827;
}

.food-card-stats span {
  margin-top: 2px;
  color: #6b7280;
}

.food-card-summary {
  display: -webkit-box;
  position: relative;
  z-index: 1;
  min-height: 44px;
  margin: 14px 0 0;
  overflow: hidden;
  line-height: 1.6;
  color: #4b5563;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.food-card-actions {
  display: flex;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
  gap: 8px;
  padding-top: 14px;
  margin-top: auto;
  border-top: 1px solid #eef2f7;
}

.card-empty {
  padding: 56px 0;
}

.card-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.content-tabs {
  max-width: 1400px;
  margin: 0 auto;
}

.statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}

.statistics-cards {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.stat-card-label {
  color: #6b7280;
}

.stat-card-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 800;
  color: #111827;
}

.stat-card-value span {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.chart-grid,
.rank-grid,
.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.summary-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.rank-list,
.summary-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  border-bottom: 1px solid #f1f5f9;
}

.summary-card {
  width: 100%;
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: #f9fafb;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.summary-card strong,
.summary-card span {
  display: block;
}

.summary-card strong {
  margin-bottom: 6px;
  color: #111827;
}

.summary-card span {
  overflow: hidden;
  color: #6b7280;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dish-link {
  height: auto;
  padding: 0;
  font-weight: 700;
}

.summary-text {
  display: -webkit-box;
  max-width: 360px;
  overflow: hidden;
  line-height: 1.55;
  color: #4b5563;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.table-dish-cell {
  min-width: 0;
}

.table-dish-cell span {
  display: block;
  margin-top: 2px;
  color: #64748b;
}

.score-time-text {
  color: #334155;
}

:deep(.table-row-to-improve > td) {
  background: #fff7ed;
}

:deep(.table-row-to-improve > td:first-child) {
  box-shadow: inset 3px 0 0 #f97316;
}

.muted {
  color: #9ca3af;
}

.detail-title-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.detail-title-row h2 {
  margin: 0 0 10px;
  font-size: 26px;
  font-weight: 800;
  color: #111827;
}

.detail-title-input {
  max-width: 420px;
  margin-bottom: 10px;
  font-size: 24px;
  font-weight: 800;
}

.detail-date {
  flex-shrink: 0;
  color: #6b7280;
}

.detail-inline-editable {
  display: inline-block;
  min-width: 36px;
  max-width: 100%;
  padding: 2px 4px;
  margin: -2px -4px;
  cursor: pointer;
  border: 1px dashed transparent;
  border-radius: 6px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.detail-inline-editable:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.detail-title-editable {
  display: block;
}

.detail-number-input {
  width: 120px;
}

.detail-table-cell-editable {
  width: 100%;
  min-height: 30px;
}

.detail-textarea-input {
  width: 100%;
}

.detail-switch-editor {
  display: flex;
  gap: 8px;
  align-items: center;
}

.review-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.review-grid > div {
  min-height: 86px;
  padding: 12px;
  background: #f9fafb;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.review-grid strong {
  display: block;
  margin-bottom: 8px;
  color: #374151;
}

.review-grid p {
  margin: 0;
  line-height: 1.7;
  color: #4b5563;
  white-space: pre-wrap;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px solid #eef2f7;
}

.food-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.food-form-section {
  padding: 0;
}

.food-form-section-head {
  display: flex;
  position: relative;
  align-items: center;
  width: 100%;
  padding: 0;
  margin-bottom: 16px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.food-form-section-head::before {
  flex: 0 0 48px;
  height: 1px;
  margin-right: 20px;
  content: '';
  background: #f0f0f0;
}

.food-form-section-head::after {
  flex: 1 1 auto;
  height: 1px;
  margin-left: 20px;
  content: '';
  background: #f0f0f0;
}

.food-form-section-head span {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  color: #374151;
}

.food-form-section-head small {
  display: none;
}

.section-arrow {
  display: none;
}

.form-chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.form-chip {
  min-height: 34px;
  padding: 6px 14px;
  font-size: 14px;
  line-height: 20px;
  color: #475569;
  cursor: pointer;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.form-chip.is-active {
  color: #0958d9;
  background: #e6f4ff;
  border-color: #91caff;
  box-shadow: inset 0 0 0 1px rgb(22 119 255 / 0.16);
}

.form-chip.is-done.is-active {
  color: #15803d;
  background: #dcfce7;
  border-color: #86efac;
}

.form-chip.is-to_improve.is-active {
  color: #c2410c;
  background: #ffedd5;
  border-color: #fdba74;
}

.form-chip.is-archived.is-active {
  color: #1d4ed8;
  background: #dbeafe;
  border-color: #93c5fd;
}

.mobile-form-footer {
  display: none;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
}

.editable-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.editable-row {
  display: grid;
  gap: 8px;
  align-items: center;
}

.ingredient-row {
  grid-template-columns: 1.1fr 0.8fr 0.7fr 1.4fr auto;
}

.step-row {
  grid-template-columns: 74px 1fr 2fr 96px auto;
}

.step-no,
.duration {
  width: 100%;
}

.image-groups,
.image-edit-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-group h3 {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: #374151;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.image-card,
.image-edit-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.image-card img,
.image-edit-card img,
.image-placeholder {
  width: 100%;
  height: 128px;
  object-fit: cover;
  background: #f3f4f6;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.image-card p {
  padding: 8px 10px;
  margin: 0;
  color: #4b5563;
}

.image-upload-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr) auto;
  gap: 10px;
  margin-bottom: 12px;
}

.image-edit-card {
  display: grid;
  grid-template-columns: 150px 130px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px;
}

.image-edit-card img,
.image-edit-card .image-placeholder {
  height: 92px;
  border-radius: 6px;
}

.image-save-tip {
  padding: 14px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

@media (max-width: 900px) {
  :global(.food-form-modal-wrap .ant-modal) {
    top: 0;
    width: 100vw !important;
    max-width: 100vw;
    height: 100dvh;
    padding-bottom: 0;
    margin: 0;
  }

  :global(.food-form-modal-wrap .ant-modal-content) {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    border-radius: 0;
  }

  :global(.food-form-modal-wrap .ant-modal-header) {
    flex-shrink: 0;
    padding: 16px 18px 12px;
    margin-bottom: 0;
    border-bottom: 1px solid #eef2f7;
  }

  :global(.food-form-modal-wrap .ant-modal-close) {
    top: 12px;
  }

  :global(.food-form-modal-wrap .ant-modal-body) {
    flex: 1 1 auto;
    padding: 12px 14px 0;
    overflow-y: auto;
    background: #f6f8fb;
  }

  .food-record-page {
    padding: 14px;
  }

  .filter-item,
  .date-item {
    width: 100%;
  }

  .filter-bar :deep(.ant-btn) {
    width: 100%;
  }

  .form-grid,
  .review-grid,
  .overview-cards,
  .record-card-grid,
  .statistics-cards,
  .chart-grid,
  .rank-grid,
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .food-form {
    gap: 10px;
    padding-bottom: 86px;
  }

  .food-form-section {
    overflow: hidden;
    background: #fff;
    border: 1px solid #e8edf3;
    border-radius: 8px;
  }

  .food-form-section-head {
    gap: 10px;
    padding: 14px;
    margin-bottom: 0;
  }

  .food-form-section-head::before,
  .food-form-section-head::after {
    display: none;
  }

  .food-form-section-head span {
    min-width: 74px;
    font-size: 15px;
    color: #111827;
  }

  .food-form-section-head small {
    display: block;
    flex: 1 1 auto;
    overflow: hidden;
    font-size: 12px;
    color: #64748b;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-arrow {
    display: inline-flex;
    flex-shrink: 0;
    color: #94a3b8;
  }

  .food-form-section-head.is-static {
    cursor: default;
  }

  .food-form-section-body {
    padding: 0 14px 14px;
    border-top: 1px solid #f1f5f9;
  }

  .food-form-section-body .form-grid {
    gap: 0;
  }

  .food-form-section-body :deep(.ant-form-item) {
    margin-bottom: 14px;
  }

  .food-form-section-body :deep(.ant-form-item:last-child) {
    margin-bottom: 0;
  }

  .form-chip-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .form-chip {
    width: 100%;
    border-radius: 8px;
  }

  .mobile-form-footer {
    display: grid;
    position: sticky;
    bottom: 0;
    z-index: 5;
    grid-template-columns: 0.85fr 1.15fr;
    gap: 10px;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom));
    margin: 0 -14px;
    background: rgb(255 255 255 / 0.96);
    border-top: 1px solid #e5e7eb;
    box-shadow: 0 -10px 24px rgb(15 23 42 / 0.08);
    backdrop-filter: blur(10px);
  }

  .mobile-form-footer :deep(.ant-btn) {
    height: 42px;
  }

  .ingredient-row,
  .step-row,
  .image-upload-row,
  .image-edit-card {
    grid-template-columns: 1fr;
  }

  .editable-list {
    gap: 12px;
  }

  .editable-row {
    padding: 10px;
    background: #f8fafc;
    border: 1px solid #edf2f7;
    border-radius: 8px;
  }

  .detail-title-row {
    flex-direction: column;
  }

  .records-toolbar,
  .food-card-actions,
  .card-pagination {
    align-items: stretch;
    justify-content: flex-start;
  }

  .records-toolbar {
    flex-direction: column;
  }

  .food-card-actions :deep(.ant-btn) {
    flex: 1 1 30%;
  }

  .food-card {
    min-height: 0;
    padding: 14px;
  }

  .food-card-header {
    gap: 8px;
    align-items: center;
  }

  .food-card-title {
    font-size: 17px;
  }

  .food-card-meta {
    gap: 6px;
    margin-top: 10px;
  }

  .food-card-meta span {
    max-width: 100%;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
    border-radius: 8px;
  }

  .food-card-mobile-layer {
    display: flex;
    position: relative;
    z-index: 1;
    flex-direction: column;
    gap: 8px;
    padding: 10px 0 0;
    color: #64748b;
    border-top: 1px solid #eef2f7;
    margin-top: 12px;
  }

  .food-card-mobile-layer > span {
    overflow: hidden;
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .food-card-mobile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .food-card-stats,
  .food-card-summary,
  .food-card-tags {
    display: none;
  }

  .food-card-actions {
    gap: 6px;
    padding-top: 10px;
    margin-top: 10px;
  }

  .food-card-actions :deep(.ant-btn) {
    min-width: 0;
    padding-inline: 8px;
  }

  .food-card:hover {
    transform: translateY(-2px);
  }

  .food-card:hover::after {
    opacity: 0.55;
  }
}
</style>
