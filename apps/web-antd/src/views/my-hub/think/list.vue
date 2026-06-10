<script setup lang="ts">
import type {
  ThoughtStatisticsDistributionItem,
  ThoughtStatisticsOverview,
  ThoughtStatisticsTrendOverview,
  ThoughtStatisticsTrendReq,
} from '#/api/core/think';
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, nextTick, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRoute } from 'vue-router';

import { DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons-vue';
import { IconifyIcon } from '@vben/icons';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Spin,
  TabPane,
  Tabs,
} from 'ant-design-vue';

import {
  deleteData as deleteThink,
  getThoughtStatisticsOverview,
  getThoughtStatisticsTrend,
  query as queryThink,
  save as saveThink,
  update as updateThink,
} from '#/api/core/think';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

type ThemeKey = 'blue' | 'cyan' | 'teal' | 'green' | 'purple' | 'indigo' | 'pink' | 'orange';
type ThoughtStatus = 'pending' | 'ongoing' | 'done' | 'shelved' | 'archived';
type ThoughtStatusFilter = 'all' | ThoughtStatus;

const route = useRoute();

type CategoryKey =
  | 'all'
  | 'work'
  | 'life'
  | 'healthy'
  | 'study'
  | 'social'
  | 'creation'
  | 'aio-life'
  | 'travel';

const statusSelectOptions: Array<{ label: string; value: ThoughtStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'ongoing' },
  { label: '已完成', value: 'done' },
  { label: '已搁置', value: 'shelved' },
  { label: '已归档', value: 'archived' },
];

const createStatusSelectOptions = statusSelectOptions.filter(
  (item): item is { label: string; value: ThoughtStatus } =>
    item.value !== 'all',
);

const statusFilter = ref<ThoughtStatusFilter>('pending');
const subjectKeyword = ref('');
let subjectSearchTimer: ReturnType<typeof setTimeout> | undefined;

const getThoughtStatusKey = (status: any): ThoughtStatus => {
  const key = String(status ?? '').trim();
  if (
    key === 'pending' ||
    key === 'ongoing' ||
    key === 'done' ||
    key === 'shelved' ||
    key === 'archived'
  ) {
    return key;
  }
  return 'pending';
};

const getThoughtStatusLabel = (status: any): string => {
  const key = getThoughtStatusKey(status);
  if (key === 'pending') return '待处理';
  if (key === 'ongoing') return '进行中';
  if (key === 'done') return '已完成';
  if (key === 'shelved') return '已搁置';
  return '已归档';
};

const categoryPresets: Record<
  Exclude<CategoryKey, 'all'>,
  { title: string; themeKey: ThemeKey; icon: string; accent: string; rgb: string }
> = {
  work: {
    title: '工作',
    themeKey: 'cyan',
    icon: '/thought-icons/work.png',
    accent: '#06b6d4',
    rgb: '6 182 212',
  },
  life: {
    title: '生活',
    themeKey: 'green',
    icon: '/thought-icons/life.png',
    accent: '#22c55e',
    rgb: '34 197 94',
  },
  healthy: {
    title: '健康',
    themeKey: 'teal',
    icon: '/thought-icons/healthy.png',
    accent: '#2dd4bf',
    rgb: '45 212 191',
  },
  study: {
    title: '学习',
    themeKey: 'blue',
    icon: '/thought-icons/study.png',
    accent: '#1677ff',
    rgb: '22 119 255',
  },
  social: {
    title: '社交',
    themeKey: 'pink',
    icon: '/thought-icons/social.png',
    accent: '#ec4899',
    rgb: '236 72 153',
  },
  creation: {
    title: '创作',
    themeKey: 'purple',
    icon: '/thought-icons/creation.png',
    accent: '#a855f7',
    rgb: '168 85 247',
  },
  'aio-life': {
    title: 'AIO-LIFE开发',
    themeKey: 'indigo',
    icon: '/thought-icons/aio-life.png',
    accent: '#6366f1',
    rgb: '99 102 241',
  },
  travel: {
    title: '旅行',
    themeKey: 'orange',
    icon: '/thought-icons/travel.png',
    accent: '#f97316',
    rgb: '249 115 22',
  },
};

const trendRangeOptions = [
  { label: '最近 7 天', value: '7d' },
  { label: '最近 30 天', value: '30d' },
  { label: '本月', value: 'month' },
  { label: '本年', value: 'year' },
];

const trendGroupOptions = [
  { label: '按日', value: 'day' },
  { label: '按周', value: 'week' },
  { label: '按月', value: 'month' },
];

const trendCategoryOptions = [
  { label: '全部分类', value: '' },
  ...Object.values(categoryPresets).map((item) => ({
    label: item.title,
    value: item.themeKey,
  })),
];

const trendStatusOptions = [
  { label: '全部状态', value: '' },
  ...statusSelectOptions
    .filter((item) => item.value !== 'all')
    .map((item) => ({ label: item.label, value: item.value })),
];

const activeCategoryKey = computed<CategoryKey>(() => {
  const seg = route.path.split('/')[2] ?? 'all';
  const key = seg.trim();
  if (
    key === 'all' ||
    key === 'work' ||
    key === 'life' ||
    key === 'healthy' ||
    key === 'study' ||
    key === 'social' ||
    key === 'creation' ||
    key === 'aio-life' ||
    key === 'travel'
  ) {
    return key;
  }
  return 'all';
});

const activeCategoryThemeKey = computed<ThemeKey | ''>(() => {
  if (activeCategoryKey.value === 'all') return '';
  return categoryPresets[activeCategoryKey.value].themeKey;
});

const getCategoryTitleByThemeKey = (themeKey: ThemeKey | string | undefined) => {
  const key = (themeKey ?? '').trim() as ThemeKey;
  const match = Object.values(categoryPresets).find((p) => p.themeKey === key);
  return match?.title ?? '闪念';
};

const getCategoryIconByThemeKey = (themeKey: ThemeKey | string | undefined) => {
  const key = (themeKey ?? '').trim() as ThemeKey;
  const match = Object.values(categoryPresets).find((p) => p.themeKey === key);
  return match?.icon ?? categoryPresets.work.icon;
};

const thoughtThemePresets: Array<{
  key: ThemeKey;
  label: string;
  accent: string;
  rgb: string;
  icon: string;
}> = [
  {
    key: 'blue',
    label: '蓝',
    accent: '#1677ff',
    rgb: '22 119 255',
    icon: 'lucide:file-text',
  },
  { key: 'cyan', label: '青', accent: '#06b6d4', rgb: '6 182 212', icon: 'lucide:zap' },
  {
    key: 'teal',
    label: '薄荷',
    accent: '#2dd4bf',
    rgb: '45 212 191',
    icon: 'lucide:activity',
  },
  {
    key: 'green',
    label: '绿',
    accent: '#22c55e',
    rgb: '34 197 94',
    icon: 'lucide:check-circle-2',
  },
  {
    key: 'purple',
    label: '紫',
    accent: '#a855f7',
    rgb: '168 85 247',
    icon: 'lucide:sparkles',
  },
  {
    key: 'indigo',
    label: '靛',
    accent: '#6366f1',
    rgb: '99 102 241',
    icon: 'lucide:terminal',
  },
  { key: 'pink', label: '粉', accent: '#ec4899', rgb: '236 72 153', icon: 'lucide:heart' },
  {
    key: 'orange',
    label: '橙',
    accent: '#f97316',
    rgb: '249 115 22',
    icon: 'lucide:flame',
  },
];

const getThemePreset = (themeKey: ThemeKey) => {
  return (
    thoughtThemePresets.find((item) => item.key === themeKey) ??
    thoughtThemePresets[0]!
  );
};

interface Event {
  id: number | string;
  content: string;
  create_time: string;
}

interface Thought {
  id: number | string;
  subject?: string;
  content: string;
  events: Event[];
  likes: number;
  createTime: string;
  themeKey?: ThemeKey | string;
  status?: ThoughtStatus | string;
}

const thoughts = ref<Thought[]>([]);
const loading = ref(false);
let latestLoadSeq = 0;

const activeTab = ref<'list' | 'statistics'>('list');
const statisticsLoading = ref(false);
const statisticsData = ref<ThoughtStatisticsOverview | null>(null);
const trendLoading = ref(false);
const trendData = ref<ThoughtStatisticsTrendOverview | null>(null);
const statusChartRef = ref<EchartsUIType>();
const categoryChartRef = ref<EchartsUIType>();
const trendChartRef = ref<EchartsUIType>();
const categoryTrendChartRef = ref<EchartsUIType>();
const activityChartRef = ref<EchartsUIType>();
const { renderEcharts: renderStatusChart } = useEcharts(statusChartRef);
const { renderEcharts: renderCategoryChart } = useEcharts(categoryChartRef);
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);
const { renderEcharts: renderCategoryTrendChart } = useEcharts(categoryTrendChartRef);
const { renderEcharts: renderActivityChart } = useEcharts(activityChartRef);

const trendFilters = reactive<Required<ThoughtStatisticsTrendReq>>({
  range: '30d',
  groupBy: 'day',
  category: '',
  status: '',
});

const showModal = ref(false);
const currentEditId = ref<null | number | string>(null);
const currentModalCreateTime = ref('');
const modalMode = ref<'edit' | 'view'>('view');

interface ThoughtForm {
  subject: string;
  content: string;
  events: Event[];
  themeKey: '' | ThemeKey;
  status: ThoughtStatus;
}

const form = reactive<ThoughtForm>({
  subject: '',
  content: '',
  events: [
    {
      id: 1,
      content: '',
      create_time: new Date().toISOString(),
    },
  ],
  themeKey: '',
  status: 'pending',
});

const isExtraOpen = ref(false);
const detailEditingField = ref<null | 'content' | 'subject'>(null);
const detailSubjectDraft = ref('');
const detailContentDraft = ref('');
const inlineSaving = ref(false);

const isExistingThoughtEdit = computed(() => currentEditId.value !== null);

const contentCharCount = computed(() => String(form.content ?? '').trim().length);
const validModalEvents = computed(() =>
  (form.events ?? []).filter((event) => event.content.trim() !== ''),
);
const eventCount = computed(() => validModalEvents.value.length);

const formAccent = computed(() => {
  const key = (form.themeKey || 'blue') as ThemeKey;
  return getThemePreset(key);
});

const emptyStatisticsSummary = {
  totalCount: 0,
  weekNewCount: 0,
  monthNewCount: 0,
  pendingCount: 0,
  doneCount: 0,
  archivedCount: 0,
  conversionRate: 0,
  backlogCount: 0,
  highValueCount: 0,
};

const statisticsSummary = computed(
  () => statisticsData.value?.summary ?? emptyStatisticsSummary,
);

const primaryStatisticsCards = computed(() => [
  {
    label: '总闪念数',
    value: statisticsSummary.value.totalCount,
    hint: '累计记录',
    tone: 'blue',
  },
  {
    label: '待处理',
    value: statisticsSummary.value.pendingCount,
    hint: '需要关注',
    tone: 'amber',
  },
  {
    label: '本月新增',
    value: statisticsSummary.value.monthNewCount,
    hint: '本月活跃',
    tone: 'green',
  },
  {
    label: '转化率',
    value: statisticsSummary.value.conversionRate,
    suffix: '%',
    hint: '完成占比',
    tone: 'purple',
  },
]);

const secondaryStatisticsItems = computed(() => [
  { label: '本周新增', value: statisticsSummary.value.weekNewCount },
  { label: '已完成', value: statisticsSummary.value.doneCount },
  { label: '已归档', value: statisticsSummary.value.archivedCount },
  { label: '积压数', value: statisticsSummary.value.backlogCount },
]);

const hasStatusDistributionData = computed(() =>
  (statisticsData.value?.statusDistribution ?? []).some((item) => item.count > 0),
);

const hasCategoryDistributionData = computed(() =>
  (statisticsData.value?.categoryDistribution ?? []).some((item) => item.count > 0),
);

const hasTrendData = computed(() =>
  (trendData.value?.trend ?? []).some((item) => item.count > 0),
);

const hasCategoryTrendData = computed(() =>
  (trendData.value?.categoryTrends ?? []).some((category) =>
    category.points.some((point) => point.count > 0),
  ),
);

const hasActivityData = computed(() =>
  (trendData.value?.activity ?? []).some((item) => item.count > 0),
);

// 计算属性
const modalTitle = computed(() => {
  if (currentEditId.value === null) return '新增闪念';
  return modalMode.value === 'view' ? '闪念详情' : '编辑闪念';
});

const modalDetailTitle = computed(() => {
  const subject = form.subject.trim();
  if (subject) return subject;
  const content = form.content.trim();
  if (!content) return '未命名闪念';
  return content.split(/\r?\n/)[0]?.trim() || content;
});

const modalDetailContent = computed(() => form.content.trim() || '—');

const resetDetailInlineEdit = () => {
  detailEditingField.value = null;
  detailSubjectDraft.value = '';
  detailContentDraft.value = '';
};

const beginDetailInlineEdit = (field: 'content' | 'subject') => {
  if (modalMode.value !== 'view' || currentEditId.value === null) return;
  detailEditingField.value = field;
  detailSubjectDraft.value = form.subject.trim();
  detailContentDraft.value = form.content;
};

const cancelDetailInlineEdit = () => {
  resetDetailInlineEdit();
};

const buildThoughtPayload = () => {
  const subject = form.subject.trim();
  const content = form.content.trim();
  const finalSubject = subject || (content ? getThoughtCardTitle({ id: 0, content } as any) : '');
  if (!finalSubject) {
    message.warning('主题内容不能为空');
    return null;
  }
  form.subject = finalSubject;

  if (!form.themeKey) {
    message.warning('类型不能为空');
    return null;
  }

  const validEvents = form.events.filter(
    (event) => event.content.trim() !== '',
  );

  const payload: any = {
    subject: finalSubject,
    topic: finalSubject,
    content,
    themeKey: form.themeKey,
    status: form.status,
    events: validEvents.map((e) => ({ ...e })),
  };

  if (currentEditId.value !== null) {
    payload.id = currentEditId.value;
  }

  return payload;
};

const getThoughtThemeKey = (thought: Thought): ThemeKey => {
  const themeKey = String(thought?.themeKey ?? '').trim() as ThemeKey;
  if (themeKey && thoughtThemePresets.some((p) => p.key === themeKey)) {
    return themeKey;
  }
  return 'blue';
};

const getThoughtStyle = (thought: Thought) => {
  const preset = getThemePreset(getThoughtThemeKey(thought));
  return {
    '--thought-accent': preset.accent,
    '--thought-accent-rgb': preset.rgb,
  } as any;
};

const getThoughtCardTitle = (thought: Thought) => {
  const subject = (thought?.subject ?? '').trim();
  if (subject) return subject.length > 16 ? `${subject.slice(0, 16)}…` : subject;
  const trimmed = (thought?.content ?? '').trim();
  if (!trimmed) return '';
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? '';
  const base = firstLine || trimmed;
  return base.length > 16 ? `${base.slice(0, 16)}…` : base;
};

const getThoughtCardPreview = (thought: Thought) => {
  const trimmed = (thought?.content ?? '').trim();
  if (!trimmed) return '';
  const oneLine = trimmed.replace(/\s+/g, ' ');
  return oneLine.length > 20 ? `${oneLine.slice(0, 20)}…` : oneLine;
};

// 方法
const openAddModal = () => {
  form.subject = '';
  form.content = '';
  form.events = [
    {
      id: Date.now(),
      content: '',
      create_time: new Date().toISOString(),
    },
  ];
  form.themeKey = activeCategoryThemeKey.value || 'blue';
  form.status = 'pending';
  currentEditId.value = null;
  currentModalCreateTime.value = new Date().toISOString();
  modalMode.value = 'edit';
  isExtraOpen.value = false;
  resetDetailInlineEdit();
  showModal.value = true;
};

const openEditModal = (id: number | string) => {
  const thought = thoughts.value.find((t) => t.id === id);
  if (thought) {
    form.subject = (thought.subject ?? '').trim();
    form.content = thought.content;
    form.themeKey = (thought.themeKey as any) ?? '';
    form.status = getThoughtStatusKey((thought as any).status);
    const evs = Array.isArray(thought.events) ? thought.events : [];
    form.events =
      evs.length > 0
        ? evs.map((e) => ({
            ...e,
            create_time:
              (e as any)?.create_time ??
              (e as any)?.createTime ??
              new Date().toISOString(),
          }))
        : [
            {
              id: Date.now(),
              content: '',
              create_time: new Date().toISOString(),
            },
          ];
    currentEditId.value = id;
    currentModalCreateTime.value = thought.createTime;
    modalMode.value = 'view';
    isExtraOpen.value = false;
    resetDetailInlineEdit();
    showModal.value = true;
  }
};

const closeCardModal = () => {
  showModal.value = false;
  isExtraOpen.value = false;
  modalMode.value = 'view';
  resetDetailInlineEdit();
};

const enterEditMode = () => {
  modalMode.value = 'edit';
  isExtraOpen.value = currentEditId.value !== null;
  resetDetailInlineEdit();
};

const addEvent = () => {
  form.events.push({
    id: Date.now(),
    content: '',
    create_time: new Date().toISOString(),
  });
};

const removeEventById = (id: number | string) => {
  const idx = form.events.findIndex((e) => e.id === id);
  if (idx !== -1) form.events.splice(idx, 1);
};

const saveDetailInlineField = async (field: 'content' | 'subject') => {
  if (currentEditId.value === null || inlineSaving.value) return;

  const oldSubject = form.subject;
  const oldContent = form.content;
  if (field === 'subject') {
    form.subject = detailSubjectDraft.value.trim();
  } else {
    form.content = detailContentDraft.value;
  }

  const payload = buildThoughtPayload();
  if (!payload) {
    form.subject = oldSubject;
    form.content = oldContent;
    return;
  }

  inlineSaving.value = true;
  try {
    await updateThink(toRaw(payload));
    resetDetailInlineEdit();
    await loadThoughts();
    await refreshThoughtStatisticsAfterMutation();
    message.success('保存成功');
  } catch {
    form.subject = oldSubject;
    form.content = oldContent;
    message.error('保存失败');
  } finally {
    inlineSaving.value = false;
  }
};

const handleDetailInlineBlur = (field: 'content' | 'subject') => {
  if (detailEditingField.value !== field) return;
  void saveDetailInlineField(field);
};

const handleDetailInlineKeydown = (event: KeyboardEvent, field: 'content' | 'subject') => {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelDetailInlineEdit();
    return;
  }

  if (event.key === 'Enter' && (field === 'subject' || event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    void saveDetailInlineField(field);
  }
};

const saveCard = async () => {
  const payload = buildThoughtPayload();
  if (!payload) return;

  try {
    if (currentEditId.value === null) {
      await saveThink(toRaw(payload));
    } else {
      await updateThink(toRaw(payload));
    }
    closeCardModal();
    await loadThoughts();
    await refreshThoughtStatisticsAfterMutation();
    message.success('保存成功');
  } catch {
    message.error('保存失败');
  }
};

const handleDelete = async (id: number | string) => {
  try {
    await deleteThink({ idList: [id] });
    thoughts.value = thoughts.value.filter((t) => t.id !== id);
    await refreshThoughtStatisticsAfterMutation();
    message.success('删除成功');
    closeCardModal();
  } catch {
    message.error('删除失败');
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const padZero = (num: number) => num.toString().padStart(2, '0');

  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1);
  const day = padZero(date.getDate());
  const hours = padZero(date.getHours());
  const minutes = padZero(date.getMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

const toSafeCount = (value: unknown) => {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
};

const buildDistributionPieOption = (
  title: string,
  data: ThoughtStatisticsDistributionItem[],
) => ({
  color: ['#1677ff', '#22c55e', '#2dd4bf', '#a855f7', '#ec4899', '#6366f1', '#f97316', '#94a3b8'],
  tooltip: {
    trigger: 'item',
    formatter: (params: any) =>
      `${params.name}<br/>数量：${params.value}<br/>占比：${params.data.percent}%`,
  },
  legend: {
    bottom: 0,
    type: 'scroll',
    itemWidth: 10,
    itemHeight: 10,
    textStyle: {
      color: '#64748b',
      fontSize: 12,
    },
  },
  series: [
    {
      name: title,
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderColor: '#fff',
        borderRadius: 6,
        borderWidth: 3,
      },
      label: {
        formatter: '{b}\n{d}%',
      },
      data: data
        .filter((item) => item.count > 0)
        .map((item) => ({
          name: item.name,
          value: item.count,
          percent: item.percent,
        })),
    },
  ],
});

const buildTrendLineOption = () => {
  const points = trendData.value?.trend ?? [];
  return {
    color: ['#1677ff'],
    grid: { bottom: 36, left: 38, right: 20, top: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((item) => item.date),
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        name: '新增闪念',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: { color: 'rgba(22, 119, 255, 0.12)' },
        data: points.map((item) => toSafeCount(item.count)),
      },
    ],
  };
};

const buildCategoryTrendBarOption = () => {
  const categoryTrends = trendData.value?.categoryTrends ?? [];
  const categories = categoryTrends.map((item) => item.categoryName);
  const values = categoryTrends.map((item) =>
    item.points.reduce((sum, point) => sum + toSafeCount(point.count), 0),
  );
  return {
    color: ['#22c55e'],
    grid: { bottom: 36, left: 38, right: 20, top: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        name: '分类新增',
        type: 'bar',
        barMaxWidth: 34,
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        data: values,
      },
    ],
  };
};

const buildActivityBarOption = () => {
  const points = trendData.value?.activity ?? [];
  return {
    color: ['#a855f7'],
    grid: { bottom: 36, left: 38, right: 20, top: 28 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: points.map((item) => item.date),
      axisLabel: { color: '#64748b' },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        name: '活跃度',
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { borderRadius: [8, 8, 0, 0] },
        data: points.map((item) => toSafeCount(item.count)),
      },
    ],
  };
};

const renderStatisticsCharts = async () => {
  const data = statisticsData.value;
  if (!data) return;
  await nextTick();
  if (hasStatusDistributionData.value) {
    renderStatusChart(
      buildDistributionPieOption('状态分布', data.statusDistribution) as any,
    );
  }
  if (hasCategoryDistributionData.value) {
    renderCategoryChart(
      buildDistributionPieOption('分类分布', data.categoryDistribution) as any,
    );
  }
};

const renderTrendCharts = async () => {
  const data = trendData.value;
  if (!data) return;
  await nextTick();
  if (hasTrendData.value) {
    renderTrendChart(buildTrendLineOption() as any);
  }
  if (hasCategoryTrendData.value) {
    renderCategoryTrendChart(buildCategoryTrendBarOption() as any);
  }
  if (hasActivityData.value) {
    renderActivityChart(buildActivityBarOption() as any);
  }
};

const loadThoughtStatistics = async () => {
  statisticsLoading.value = true;
  try {
    statisticsData.value = await getThoughtStatisticsOverview();
    await renderStatisticsCharts();
  } catch {
    message.error('统计数据加载失败');
  } finally {
    statisticsLoading.value = false;
  }
};

const loadThoughtTrend = async () => {
  trendLoading.value = true;
  try {
    trendData.value = await getThoughtStatisticsTrend({ ...trendFilters });
    await renderTrendCharts();
  } catch {
    message.error('趋势数据加载失败');
  } finally {
    trendLoading.value = false;
  }
};

const loadStatisticsTabData = async () => {
  if (!statisticsData.value) {
    await loadThoughtStatistics();
  } else {
    await renderStatisticsCharts();
  }
  if (!trendData.value) {
    await loadThoughtTrend();
  } else {
    await renderTrendCharts();
  }
};

const invalidateThoughtStatistics = () => {
  statisticsData.value = null;
  trendData.value = null;
};

const refreshThoughtStatisticsAfterMutation = async () => {
  invalidateThoughtStatistics();
  if (activeTab.value === 'statistics') {
    await loadStatisticsTabData();
  }
};

// 生命周期
const loadThoughts = async () => {
  const loadSeq = ++latestLoadSeq;
  const currentThemeKey = activeCategoryThemeKey.value;
  const currentStatus = statusFilter.value;
  const currentSubjectKeyword = subjectKeyword.value.trim();
  loading.value = true;
  try {
    const condition: Record<string, any> = {};
    if (currentThemeKey) {
      condition.themeKey = currentThemeKey;
    }
    if (currentStatus !== 'all') {
      condition.status = currentStatus;
    }
    if (currentSubjectKeyword) {
      condition.subject = currentSubjectKeyword;
    }
    const res = await queryThink({ page: 1, pageSize: 50, condition });
    if (loadSeq !== latestLoadSeq) {
      return;
    }
    const list = (res && (res.items ?? res)) || [];
    thoughts.value = list
      .map((t: any) => ({
        ...t,
        subject:
          String(t?.subject ?? '')
            .trim()
            ? String(t?.subject ?? '').trim()
            : String(t?.topic ?? '').trim(),
        content: t?.content ?? t?.text ?? t?.title ?? t?.summary ?? '',
        themeKey: t?.themeKey ?? t?.theme_key ?? '',
        status: getThoughtStatusKey(t?.status),
        events: Array.isArray(t?.events)
          ? t.events.map((e: any) => ({
              ...e,
              create_time:
                e?.create_time ?? e?.createTime ?? new Date().toISOString(),
            }))
          : [],
        date: t?.date ?? new Date().toISOString(),
        createTime: t?.createTime ?? t?.create_time ?? new Date().toISOString(),
      }))
      .filter((t: Thought) => {
        if (!currentThemeKey) return true;
        return getThoughtThemeKey(t) === currentThemeKey;
      })
      .filter((t: Thought) => {
        if (currentStatus === 'all') return true;
        return getThoughtStatusKey(t.status) === currentStatus;
      })
      .toSorted(
        (a: Thought, b: Thought) =>
          new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
      );
  } catch {
    message.error('加载失败');
  } finally {
    if (loadSeq === latestLoadSeq) {
      loading.value = false;
    }
  }
};

const handleSubjectSearch = async () => {
  if (subjectSearchTimer) {
    clearTimeout(subjectSearchTimer);
  }
  subjectKeyword.value = subjectKeyword.value.trim();
  await loadThoughts();
};

onMounted(async () => {
  await loadThoughts();
});

watch(
  () => route.fullPath,
  async () => {
    await loadThoughts();
  },
);

watch(
  () => statusFilter.value,
  async () => {
    await loadThoughts();
  },
);

watch(
  () => subjectKeyword.value,
  () => {
    if (subjectSearchTimer) {
      clearTimeout(subjectSearchTimer);
    }
    subjectSearchTimer = setTimeout(() => {
      void loadThoughts();
    }, 300);
  },
);

watch(
  () => activeTab.value,
  async (tab) => {
    if (tab !== 'statistics') return;
    await loadStatisticsTabData();
  },
);

watch(
  () => ({ ...trendFilters }),
  async () => {
    trendData.value = null;
    if (activeTab.value === 'statistics') {
      await loadThoughtTrend();
    }
  },
);
</script>

<template>
  <div class="think-page">
    <Tabs v-model:active-key="activeTab" class="think-content-tabs">
      <TabPane key="list" tab="记录列表">
    <div class="think-header">
      <div class="think-status-capsule">
        <button
          v-for="item in statusSelectOptions"
          :key="item.value"
          type="button"
          class="think-status-capsule-item"
          :class="{ 'is-active': statusFilter === item.value }"
          @click="statusFilter = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="think-subject-search">
        <Input
          v-model:value="subjectKeyword"
          allow-clear
          class="think-subject-search-input"
          placeholder="搜索主题内容"
          @press-enter="handleSubjectSearch"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </Input>
        <Button
          class="think-subject-search-button"
          type="primary"
          shape="round"
          @click="handleSubjectSearch"
        >
          <template #icon>
            <SearchOutlined />
          </template>
          搜索
        </Button>
      </div>
    </div>
    <Spin :spinning="loading">
      <template v-if="thoughts.length === 0 && !loading">
        <div class="empty-wrap">
          <Empty description="还没有任何思考记录，点击右下角或下方按钮添加">
            <Button
              type="primary"
              shape="round"
              size="large"
              @click="openAddModal"
            >
              <template #icon><PlusOutlined /></template>
              记录闪念
            </Button>
          </Empty>
        </div>
      </template>

      <div v-else class="cards-grid">
        <Card
          v-for="thought in thoughts"
          :key="thought.id"
          hoverable
          :bordered="false"
          class="thought-card"
          :style="getThoughtStyle(thought)"
          @click="openEditModal(thought.id)"
        >
          <div class="protocol-top">
            <div class="protocol-icon">
              <img
                :src="getCategoryIconByThemeKey(getThoughtThemeKey(thought))"
                :alt="getCategoryTitleByThemeKey(getThoughtThemeKey(thought))"
                class="protocol-icon-img"
              />
            </div>
            <div class="protocol-divider"></div>
            <div class="protocol-content">
              <div class="protocol-pill">
                <span>{{ getCategoryTitleByThemeKey(getThoughtThemeKey(thought)) }}</span>
              </div>
              <h3 class="protocol-title">
                {{ getThoughtCardTitle(thought) }}
              </h3>
              <p v-if="getThoughtCardPreview(thought)" class="protocol-desc">
                {{ getThoughtCardPreview(thought) }}
              </p>
            </div>
            <div
              class="protocol-badge"
              :data-theme="getThoughtThemeKey(thought)"
            ></div>
          </div>
          <div class="protocol-meta">
            <div class="protocol-meta-left">
              <span class="protocol-date">
                <IconifyIcon icon="lucide:clock" class="protocol-date-icon" />
                <span>{{ formatDate(thought.createTime) }}</span>
              </span>
            </div>
            <div class="protocol-meta-right">
              <div class="protocol-meta-pill">
                <span class="protocol-meta-count">
                  <IconifyIcon
                    icon="lucide:message-circle"
                    class="protocol-meta-count-icon"
                  />
                  <span>{{ (thought.events || []).length }}</span>
                </span>
                <span class="protocol-meta-sep"></span>
                <span class="protocol-meta-status">{{
                  getThoughtStatusLabel((thought as any).status)
                }}</span>
              </div>
              <span class="protocol-arrow">›</span>
            </div>
          </div>
        </Card>
      </div>
    </Spin>

      </TabPane>
      <TabPane key="statistics" tab="统计洞察">
        <Spin :spinning="statisticsLoading">
          <div class="thought-statistics-panel">
            <div class="thought-statistics-core">
              <Card
                v-for="item in primaryStatisticsCards"
                :key="item.label"
                :bordered="false"
                class="thought-primary-stat-card"
                :data-tone="item.tone"
              >
                <div class="thought-primary-stat-card-label">{{ item.label }}</div>
                <div class="thought-primary-stat-card-value">
                  <span>{{ item.value }}</span>
                  <em v-if="item.suffix">{{ item.suffix }}</em>
                </div>
                <div class="thought-primary-stat-card-hint">{{ item.hint }}</div>
              </Card>
            </div>

            <div class="thought-secondary-stat-strip">
              <div
                v-for="item in secondaryStatisticsItems"
                :key="item.label"
                class="thought-secondary-stat-item"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>

            <div class="thought-analysis-section">
              <div class="thought-analysis-title">分布分析</div>
              <div class="thought-chart-grid">
                <Card title="状态分布图" :bordered="false" class="thought-chart-card">
                  <div class="thought-chart-body">
                    <EchartsUI ref="statusChartRef" height="280px" />
                    <Empty
                      v-if="!hasStatusDistributionData"
                      class="thought-chart-empty"
                      description="暂无状态数据"
                    />
                  </div>
                </Card>
                <Card title="分类分布图" :bordered="false" class="thought-chart-card">
                  <div class="thought-chart-body">
                    <EchartsUI ref="categoryChartRef" height="280px" />
                    <Empty
                      v-if="!hasCategoryDistributionData"
                      class="thought-chart-empty"
                      description="暂无分类数据"
                    />
                  </div>
                </Card>
              </div>
            </div>

            <div class="thought-trend-section">
              <div class="thought-trend-header">
                <div class="thought-analysis-title">趋势分析</div>
                <div class="thought-trend-filters">
                  <Select
                    v-model:value="trendFilters.range"
                    :options="trendRangeOptions"
                    class="thought-trend-select"
                  />
                  <Select
                    v-model:value="trendFilters.groupBy"
                    :options="trendGroupOptions"
                    class="thought-trend-select"
                  />
                  <Select
                    v-model:value="trendFilters.category"
                    :options="trendCategoryOptions"
                    class="thought-trend-select"
                  />
                  <Select
                    v-model:value="trendFilters.status"
                    :options="trendStatusOptions"
                    class="thought-trend-select"
                  />
                </div>
              </div>

              <Spin :spinning="trendLoading">
                <div
                  v-if="trendData?.burstDays?.length"
                  class="thought-burst-strip"
                >
                  <span class="thought-burst-label">闪念爆发日</span>
                  <span
                    v-for="item in trendData.burstDays"
                    :key="item.date"
                    class="thought-burst-item"
                  >
                    {{ item.date }}：{{ item.count }} 条
                  </span>
                </div>

                <div class="thought-trend-grid">
                  <Card title="新增趋势" :bordered="false" class="thought-chart-card">
                    <div class="thought-chart-body">
                      <EchartsUI ref="trendChartRef" height="280px" />
                      <Empty
                        v-if="!hasTrendData"
                        class="thought-chart-empty"
                        description="暂无趋势数据"
                      />
                    </div>
                  </Card>
                  <Card title="分类新增" :bordered="false" class="thought-chart-card">
                    <div class="thought-chart-body">
                      <EchartsUI ref="categoryTrendChartRef" height="280px" />
                      <Empty
                        v-if="!hasCategoryTrendData"
                        class="thought-chart-empty"
                        description="暂无分类趋势数据"
                      />
                    </div>
                  </Card>
                  <Card title="活跃度" :bordered="false" class="thought-chart-card thought-trend-wide-card">
                    <div class="thought-chart-body">
                      <EchartsUI ref="activityChartRef" height="280px" />
                      <Empty
                        v-if="!hasActivityData"
                        class="thought-chart-empty"
                        description="暂无活跃度数据"
                      />
                    </div>
                  </Card>
                </div>
              </Spin>
            </div>
          </div>
        </Spin>
      </TabPane>
    </Tabs>

    <GlobalFloatBtn v-if="activeTab === 'list'" @click="openAddModal" />

    <Modal
      v-model:open="showModal"
      :title="modalTitle"
      :footer="null"
      :mask-closable="false"
      :destroy-on-close="true"
      width="720px"
      centered
      :wrap-class-name="
        !isExistingThoughtEdit ? 'thought-create-modal-wrap' : ''
      "
      @cancel="closeCardModal"
    >
      <div
        v-if="modalMode === 'view'"
        class="thought-detail"
        :style="{
          '--thought-accent': formAccent.accent,
          '--thought-accent-rgb': formAccent.rgb,
        }"
      >
        <div class="thought-detail-meta-row">
          <span class="thought-detail-tag">
            {{ getCategoryTitleByThemeKey(form.themeKey) }}
          </span>
          <span class="thought-detail-tag is-status">
            {{ getThoughtStatusLabel(form.status) }}
          </span>
          <span class="thought-detail-time">
            {{ currentModalCreateTime ? formatDate(currentModalCreateTime) : '—' }}
          </span>
        </div>

        <Input
          v-if="detailEditingField === 'subject'"
          v-model:value="detailSubjectDraft"
          class="thought-detail-title-input"
          :maxlength="60"
          :disabled="inlineSaving"
          autofocus
          allow-clear
          @blur="handleDetailInlineBlur('subject')"
          @keydown="handleDetailInlineKeydown($event, 'subject')"
        />
        <h2
          v-else
          class="thought-detail-title is-editable"
          title="双击编辑"
          @dblclick="beginDetailInlineEdit('subject')"
        >
          {{ modalDetailTitle }}
        </h2>

        <section class="thought-detail-section">
          <div class="thought-detail-section-title">闪念内容</div>
          <Input.TextArea
            v-if="detailEditingField === 'content'"
            v-model:value="detailContentDraft"
            class="thought-detail-content-editor"
            :auto-size="{ minRows: 5, maxRows: 12 }"
            :disabled="inlineSaving"
            autofocus
            @blur="handleDetailInlineBlur('content')"
            @keydown="handleDetailInlineKeydown($event, 'content')"
          />
          <div
            v-else
            class="thought-detail-content is-editable"
            title="双击编辑"
            @dblclick="beginDetailInlineEdit('content')"
          >
            {{ modalDetailContent }}
          </div>
        </section>

        <section class="thought-detail-section">
          <div class="thought-detail-section-title">扩展信息</div>
          <div class="thought-detail-summary">
            内容 {{ contentCharCount }}字 · 事件 {{ eventCount }}个
          </div>
        </section>

        <section v-if="validModalEvents.length > 0" class="thought-detail-section">
          <div class="thought-detail-section-title">关联事件流</div>
          <div class="thought-detail-events">
            <div
              v-for="event in [...validModalEvents].reverse()"
              :key="event.id"
              class="thought-detail-event"
            >
              <div class="thought-detail-event-content">{{ event.content }}</div>
              <div class="thought-detail-event-time">{{ formatDate(event.create_time) }}</div>
            </div>
          </div>
        </section>

        <div class="thought-detail-footer">
          <Button shape="round" @click="closeCardModal">关闭</Button>
          <Button type="primary" shape="round" @click="enterEditMode">
            编辑闪念
          </Button>
        </div>
      </div>

      <Form
        v-else
        layout="vertical"
        class="modern-form"
        :class="{ 'is-create-form': !isExistingThoughtEdit }"
        :style="{
          '--thought-accent': formAccent.accent,
          '--thought-accent-rgb': formAccent.rgb,
        }"
      >
        <Form.Item v-if="!isExistingThoughtEdit" label="主题内容" required>
          <Input
            v-model:value="form.subject"
            placeholder="给这条闪念取一个主题"
            :maxlength="60"
            allow-clear
          />
        </Form.Item>

        <Form.Item label="状态" required>
          <div class="modal-status-capsule">
            <button
              v-for="item in isExistingThoughtEdit
                ? statusSelectOptions
                : createStatusSelectOptions"
              :key="item.value"
              type="button"
              class="modal-capsule-item"
              :disabled="item.value === 'all'"
              :class="{
                'is-active': form.status === item.value,
                'is-disabled': item.value === 'all',
              }"
              @click="item.value !== 'all' && (form.status = item.value as ThoughtStatus)"
            >
              {{ item.label }}
            </button>
          </div>
        </Form.Item>

        <Form.Item label="类型" required>
          <div class="modal-type-capsule">
            <button
              v-for="item in thoughtThemePresets"
              :key="item.key"
              type="button"
              class="modal-capsule-item"
              :class="{ 'is-active': form.themeKey === item.key }"
              @click="form.themeKey = item.key"
            >
              {{ getCategoryTitleByThemeKey(item.key) }}
            </button>
          </div>
        </Form.Item>

        <div class="modal-divider"></div>

        <div class="modal-extra-toggle" @click="isExtraOpen = !isExtraOpen">
          <div class="modal-extra-title">
            {{ isExistingThoughtEdit ? '扩展信息' : '补充内容与事件' }}
          </div>
          <div class="modal-extra-meta">
            内容 {{ contentCharCount }}字 · 事件 {{ eventCount }}个
          </div>
          <div class="modal-extra-arrow" :class="{ 'is-open': isExtraOpen }">
            ˅
          </div>
        </div>

        <div v-if="isExtraOpen" class="modal-extra-body">
          <Form.Item
            v-if="!isExistingThoughtEdit"
            label="闪念内容"
            class="modal-content-form-item"
          >
            <Input.TextArea
              v-model:value="form.content"
              :auto-size="{ minRows: 4, maxRows: 10 }"
              placeholder="这一刻的想法..."
              class="content-textarea"
              :bordered="false"
            />
          </Form.Item>
          <div class="events-section">
            <div class="events-header">
              <span class="events-title">关联事件流</span>
            </div>
            <div
              v-for="event in [...form.events].reverse()"
              :key="event.id"
              class="event-item"
            >
              <div class="event-row">
                <Input
                  v-model:value="event.content"
                  placeholder="记录相关事件..."
                  :bordered="false"
                  class="event-input"
                />
                <Button
                  v-if="form.events.length > 1"
                  type="text"
                  danger
                  shape="circle"
                  @click="removeEventById(event.id)"
                >
                  <template #icon><DeleteOutlined /></template>
                </Button>
              </div>
              <div class="event-time">{{ formatDate(event.create_time) }}</div>
            </div>
            <Button type="dashed" block @click="addEvent" class="add-event-btn">
              <template #icon><PlusOutlined /></template>
              补充事件
            </Button>
          </div>
        </div>

        <div class="modal-footer">
          <div class="modal-footer-left">
            <Popconfirm
              v-if="currentEditId !== null"
              title="确定要删除这条思考吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="handleDelete(currentEditId!)"
            >
              <Button danger type="text">
                <template #icon><DeleteOutlined /></template>
                删除
              </Button>
            </Popconfirm>
            <Button
              v-if="isExistingThoughtEdit"
              type="text"
              @click="isExtraOpen = !isExtraOpen"
            >
              更多操作
            </Button>
          </div>
          <div class="modal-footer-right">
            <Button @click="closeCardModal" shape="round">取消</Button>
            <Button type="primary" @click="saveCard" shape="round">保存</Button>
          </div>
        </div>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
.think-page {
  max-width: 1400px;
  padding: 24px;
  margin: 0 auto;
}

.think-content-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 16px;
}

.thought-statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.thought-statistics-core {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.thought-primary-stat-card {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.96), rgb(248 250 252 / 0.9));
  box-shadow:
    0 14px 34px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.72);
}

.thought-primary-stat-card::before {
  content: '';
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 0;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: var(--stat-accent, #1677ff);
}

.thought-primary-stat-card::after {
  content: '';
  position: absolute;
  right: -36px;
  bottom: -42px;
  width: 116px;
  height: 116px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--stat-accent, #1677ff) 13%, transparent);
}

.thought-primary-stat-card[data-tone='blue'] {
  --stat-accent: #1677ff;
}

.thought-primary-stat-card[data-tone='amber'] {
  --stat-accent: #f59e0b;
}

.thought-primary-stat-card[data-tone='green'] {
  --stat-accent: #22c55e;
}

.thought-primary-stat-card[data-tone='purple'] {
  --stat-accent: #a855f7;
}

.thought-primary-stat-card-label {
  position: relative;
  z-index: 1;
  margin-bottom: 12px;
  color: rgb(15 23 42 / 0.58);
  font-size: 14px;
  font-weight: 700;
}

.thought-primary-stat-card-value {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 10px;
  color: #020617;
  font-size: 34px;
  font-weight: 800;
  line-height: 1.1;
}

.thought-primary-stat-card-value span {
  min-width: 0;
}

.thought-primary-stat-card-value em {
  color: var(--stat-accent, #1677ff);
  font-size: 15px;
  font-style: normal;
  font-weight: 800;
}

.thought-primary-stat-card-hint {
  position: relative;
  z-index: 1;
  color: rgb(15 23 42 / 0.45);
  font-size: 12px;
  font-weight: 700;
}

.thought-secondary-stat-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border: 1px solid rgb(15 23 42 / 0.06);
  border-radius: 12px;
  background: rgb(226 232 240 / 0.72);
}

.thought-secondary-stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  background: rgb(255 255 255 / 0.84);
}

.thought-secondary-stat-item span {
  color: rgb(15 23 42 / 0.62);
  font-size: 13px;
  font-weight: 700;
}

.thought-secondary-stat-item strong {
  color: #020617;
  font-size: 18px;
  font-weight: 800;
}

.thought-analysis-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.thought-analysis-title {
  color: #1e293b;
  font-size: 18px;
  font-weight: 800;
}

.thought-trend-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.thought-trend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.thought-trend-filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.thought-trend-select {
  width: 132px;
}

.thought-burst-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgb(245 158 11 / 0.2);
  border-radius: 12px;
  background: rgb(255 251 235 / 0.86);
}

.thought-burst-label {
  color: #92400e;
  font-size: 13px;
  font-weight: 800;
}

.thought-burst-item {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgb(245 158 11 / 0.12);
  color: #78350f;
  font-size: 12px;
  font-weight: 700;
}

.thought-trend-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.thought-trend-wide-card {
  grid-column: 1 / -1;
}

.thought-chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.thought-chart-card {
  min-width: 0;
  border-radius: 12px;
  background: rgb(255 255 255 / 0.86);
  box-shadow:
    0 10px 24px rgb(15 23 42 / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.72);
}

.thought-chart-card :deep(.ant-card-head-title) {
  font-size: 16px;
  font-weight: 800;
}

.thought-chart-body {
  position: relative;
  min-height: 280px;
}

.thought-chart-empty {
  position: absolute;
  inset: 0;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgb(255 255 255 / 0.86);
}

.think-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.think-status-capsule {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.78);
  border: 1px solid rgb(0 0 0 / 0.06);
  box-shadow:
    0 10px 22px rgb(0 0 0 / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.8);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}

.think-status-capsule-item {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  color: rgb(0 0 0 / 0.68);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.think-status-capsule-item:hover {
  background: rgb(255 255 255 / 0.55);
}

.think-status-capsule-item.is-active {
  background: rgb(var(--thought-accent-rgb, 22 119 255) / 0.18);
  color: rgb(var(--thought-accent-rgb, 22 119 255) / 0.92);
  box-shadow:
    0 10px 18px rgb(var(--thought-accent-rgb, 22 119 255) / 0.22),
    0 8px 16px rgb(0 0 0 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
  transform: translateY(-1px);
}

.think-subject-search {
  display: flex;
  align-items: center;
  width: min(420px, 100%);
  gap: 8px;
}

.think-subject-search-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 36px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.78);
  border-color: rgb(0 0 0 / 0.06);
  box-shadow:
    0 10px 22px rgb(0 0 0 / 0.05),
    inset 0 1px 0 rgb(255 255 255 / 0.8);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}

.think-subject-search-input :deep(.ant-input) {
  background: transparent;
}

.think-subject-search-input :deep(.ant-input-prefix) {
  color: rgb(0 0 0 / 0.42);
}

.think-subject-search-button {
  flex: 0 0 auto;
  min-height: 36px;
  font-weight: 700;
  box-shadow: 0 10px 22px rgb(var(--thought-accent-rgb, 22 119 255) / 0.18);
}

.think-back {
  padding: 0;
  height: 32px;
  font-weight: 600;
  color: rgb(0 0 0 / 0.62);
}

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 60px 20px;
  background: transparent;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.thought-card {
  margin-bottom: 0;
  position: relative;
  border-radius: 16px;
  background:
    radial-gradient(
      circle at 80% 15%,
      rgb(var(--thought-accent-rgb) / 0.14) 0%,
      transparent 55%
    ),
    radial-gradient(
      circle at 10% 90%,
      rgb(var(--thought-accent-rgb) / 0.08) 0%,
      transparent 55%
    ),
    linear-gradient(
      135deg,
      rgb(255 255 255 / 0.85) 0%,
      rgb(var(--thought-accent-rgb) / 0.08) 35%,
      rgb(255 255 255 / 0.86) 100%
    );
  transition:
    transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    box-shadow 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    border-color 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    background 0.32s cubic-bezier(0.25, 0.8, 0.25, 1);
  will-change: transform, box-shadow;
  overflow: hidden;
  border: 3px solid rgb(255 255 255 / 0.8);
  box-shadow:
    0 10px 24px rgb(0 0 0 / 6%),
    0 18px 46px rgb(var(--thought-accent-rgb) / 0.28),
    inset 0 0 0 3px rgb(var(--thought-accent-rgb) / 0.24),
    inset 0 0 0 4px rgb(255 255 255 / 0.48);
}

.thought-card::before {
  content: '';
  position: absolute;
  inset: -40%;
  background: radial-gradient(
    circle at 20% 10%,
    rgb(var(--thought-accent-rgb) / 0.28) 0%,
    transparent 55%
  );
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
    transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
  z-index: 0;
}

.thought-card::after {
  content: '';
  position: absolute;
  top: -60%;
  left: -80%;
  width: 160%;
  height: 200%;
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgb(255 255 255 / 0.22) 45%,
    transparent 60%
  );
  transform: translateX(-30%) rotate(10deg);
  opacity: 0;
  transition:
    opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1),
    transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
  z-index: 0;
}

.thought-card :deep(.ant-card-body) {
  position: relative;
  z-index: 1;
}

.thought-card :deep(.ant-card-body)::after {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 14px;
  border: 3px solid rgb(255 255 255 / 0.7);
  box-shadow:
    inset 0 0 0 3px rgb(var(--thought-accent-rgb) / 0.18),
    0 0 0 1px rgb(255 255 255 / 0.14);
  opacity: 1;
  transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
  z-index: 0;
}

.protocol-pill,
.protocol-top,
.protocol-meta {
  position: relative;
  z-index: 1;
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .think-page {
    padding: 12px;
  }

  .thought-statistics-core {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .thought-secondary-stat-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .thought-chart-grid {
    grid-template-columns: 1fr;
  }

  .thought-trend-header {
    align-items: stretch;
  }

  .thought-trend-filters {
    justify-content: flex-start;
    width: 100%;
  }

  .thought-trend-select {
    flex: 1 1 calc(50% - 8px);
    min-width: 128px;
  }

  .thought-trend-grid {
    grid-template-columns: 1fr;
  }

  .thought-trend-wide-card {
    grid-column: auto;
  }

  .think-status-capsule {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }

  .think-status-capsule::-webkit-scrollbar {
    display: none;
  }

  .think-subject-search {
    width: 100%;
  }

  .cards-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .thought-card :deep(.ant-card-body) {
    padding: 12px;
  }

  .thought-card {
    margin-bottom: 12px;
    border-color: rgb(255 255 255 / 0.68);
    box-shadow:
      0 10px 24px rgb(0 0 0 / 6%),
      0 18px 46px rgb(var(--thought-accent-rgb) / 0.2),
      inset 0 0 0 3px rgb(var(--thought-accent-rgb) / 0.18),
      inset 0 0 0 4px rgb(255 255 255 / 0.34);
  }

  .thought-card :deep(.ant-card-body)::after {
    border-color: rgb(255 255 255 / 0.58);
    box-shadow: inset 0 0 0 3px rgb(var(--thought-accent-rgb) / 0.14);
  }
}

@media (min-width: 640px) {
  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .cards-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.thought-card:hover {
  transform: translateY(-6px);
  border-color: rgb(var(--thought-accent-rgb) / 0.32);
  box-shadow:
    0 18px 40px rgb(0 0 0 / 12%),
    0 18px 40px rgb(var(--thought-accent-rgb) / 0.26),
    inset 0 0 0 1px rgb(255 255 255 / 45%);
}

.thought-card:hover::before {
  opacity: 1;
  transform: scale(1);
}

.thought-card:hover::after {
  opacity: 1;
  transform: translateX(85%) rotate(10deg);
}

.thought-card :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 22px;
}

.protocol-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--thought-accent-rgb) / 0.9);
  background: rgb(var(--thought-accent-rgb) / 0.1);
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.18);
  box-shadow:
    0 10px 24px rgb(0 0 0 / 4%),
    0 16px 34px rgb(var(--thought-accent-rgb) / 0.1);
  width: fit-content;
  padding: 4px 10px;
  border-radius: 4px;
  margin-top: -2px;
  margin-bottom: 6px;
  backdrop-filter: blur(10px);
  zoom: 0.6;
}

.protocol-pill-icon {
  width: 12px;
  height: 12px;
  color: rgb(var(--thought-accent-rgb) / 0.9);
}

@supports not (zoom: 1) {
  .protocol-pill {
    transform: scale(0.6);
    transform-origin: left top;
  }
}

.protocol-top {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding-right: 64px;
  margin-bottom: 14px;
}

.protocol-divider {
  width: 1px;
  align-self: stretch;
  margin-top: 6px;
  margin-bottom: 6px;
  background: rgb(0 0 0 / 0.06);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 40%);
}

.protocol-icon {
  width: 112px;
  height: 112px;
  border-radius: 32px;
  flex: 0 0 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: rgb(255 255 255 / 0.65);
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.16);
  box-shadow:
    0 16px 34px rgb(var(--thought-accent-rgb) / 0.16),
    inset 0 0 0 1px rgb(255 255 255 / 55%);
}

.protocol-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.25);
}

.protocol-content {
  flex: 1;
  min-width: 0;
}

.protocol-title {
  margin: 0 0 6px;
  font-size: calc(var(--font-size-base, 14px) + 2px);
  font-weight: 800;
  line-height: 1.35;
}

.protocol-desc {
  margin: 0;
  font-size: 11px;
  line-height: 1.55;
  color: rgb(0 0 0 / 0.55);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  white-space: pre-wrap;
}

.protocol-badge {
  position: absolute;
  top: -12px;
  right: -10px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(
      circle at 30% 22%,
      rgb(255 255 255 / 0.9) 0%,
      rgb(255 255 255 / 0.55) 34%,
      transparent 62%
    ),
    linear-gradient(
      145deg,
      rgb(255 255 255 / 0.78) 0%,
      rgb(var(--thought-accent-rgb) / 0.14) 42%,
      rgb(255 255 255 / 0.6) 100%
    );
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.22);
  box-shadow:
    0 18px 44px rgb(var(--thought-accent-rgb) / 0.36),
    0 16px 34px rgb(0 0 0 / 12%),
    inset 0 0 0 1px rgb(255 255 255 / 60%),
    inset 0 10px 18px rgb(255 255 255 / 18%);
  backdrop-filter: blur(16px) saturate(1.55);
}

.protocol-badge::before {
  content: '';
  position: absolute;
  inset: 11px;
  --badge-fg: rgb(var(--thought-accent-rgb) / 0.92);
  background: none;
  border: 0 solid transparent;
  border-radius: 6px;
  transform: none;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 18%));
}

.protocol-badge[data-theme='cyan']::before {
  inset: 12px;
  background:
    linear-gradient(var(--badge-fg) 0 0) 50% 18% / 100% 2px no-repeat,
    linear-gradient(var(--badge-fg) 0 0) 50% 50% / 100% 2px no-repeat,
    linear-gradient(var(--badge-fg) 0 0) 50% 82% / 78% 2px no-repeat;
  border-radius: 4px;
}

.protocol-badge[data-theme='green']::before {
  inset: 12px;
  border: 2px solid var(--badge-fg);
  border-radius: 100% 0 100% 0;
  transform: rotate(-45deg);
}

.protocol-badge[data-theme='blue']::before {
  inset: 11px;
  border: 2px solid var(--badge-fg);
  border-radius: 6px;
  background: linear-gradient(
    to right,
    transparent 0%,
    transparent 47%,
    var(--badge-fg) 47%,
    var(--badge-fg) 53%,
    transparent 53%,
    transparent 100%
  );
}

.protocol-badge[data-theme='pink']::before {
  inset: 11px;
  background:
    radial-gradient(circle at 35% 36%, var(--badge-fg) 0 3px, transparent 3.5px),
    radial-gradient(circle at 65% 36%, var(--badge-fg) 0 3px, transparent 3.5px),
    radial-gradient(ellipse at 35% 78%, var(--badge-fg) 0 6px, transparent 6.5px),
    radial-gradient(ellipse at 65% 78%, var(--badge-fg) 0 6px, transparent 6.5px);
}

.protocol-badge[data-theme='purple']::before {
  inset: 12px;
  background:
    linear-gradient(var(--badge-fg) 0 0) 50% 50% / 2px 100% no-repeat,
    linear-gradient(var(--badge-fg) 0 0) 50% 50% / 100% 2px no-repeat,
    radial-gradient(circle at 50% 50%, var(--badge-fg) 0 2px, transparent 2.5px);
  transform: rotate(45deg);
}

.protocol-badge[data-theme='orange']::before {
  inset: 11px;
  border: 2px solid var(--badge-fg);
  border-radius: 7px;
  background:
    linear-gradient(var(--badge-fg) 0 0) 50% 25% / 48% 2px no-repeat,
    linear-gradient(var(--badge-fg) 0 0) 50% 55% / 76% 2px no-repeat;
}

.protocol-badge[data-theme='teal']::before {
  inset: 10px;
  background:
    linear-gradient(120deg, transparent 0 14%, var(--badge-fg) 14% 24%, transparent 24% 100%) 0 54% / 34% 38% no-repeat,
    linear-gradient(72deg, transparent 0 34%, var(--badge-fg) 34% 45%, transparent 45% 100%) 28% 46% / 28% 66% no-repeat,
    linear-gradient(108deg, transparent 0 48%, var(--badge-fg) 48% 58%, transparent 58% 100%) 50% 48% / 30% 58% no-repeat,
    linear-gradient(76deg, transparent 0 36%, var(--badge-fg) 36% 48%, transparent 48% 100%) 72% 52% / 32% 42% no-repeat;
  border-top: 2px solid transparent;
  border-bottom: 2px solid transparent;
  border-radius: 4px;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 16%));
}

.protocol-badge[data-theme='teal']::after {
  border-radius: inherit;
}

.protocol-badge[data-theme='indigo']::before {
  inset: 10px;
  background:
    linear-gradient(135deg, transparent 0 42%, var(--badge-fg) 42% 52%, transparent 52% 100%) 3px 45% / 9px 16px no-repeat,
    linear-gradient(45deg, transparent 0 42%, var(--badge-fg) 42% 52%, transparent 52% 100%) 3px 55% / 9px 16px no-repeat,
    linear-gradient(45deg, transparent 0 42%, var(--badge-fg) 42% 52%, transparent 52% 100%) calc(100% - 12px) 45% / 9px 16px no-repeat,
    linear-gradient(135deg, transparent 0 42%, var(--badge-fg) 42% 52%, transparent 52% 100%) calc(100% - 12px) 55% / 9px 16px no-repeat,
    linear-gradient(108deg, transparent 0 42%, var(--badge-fg) 42% 52%, transparent 52% 100%) 50% 50% / 8px 24px no-repeat;
  border-radius: 5px;
  filter: drop-shadow(0 2px 4px rgb(0 0 0 / 16%));
}

.protocol-badge::after {
  content: '';
  position: absolute;
  inset: -70%;
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgb(255 255 255 / 0.68) 42%,
    rgb(255 255 255 / 0.08) 56%,
    transparent 70%
  );
  transform: translateX(-42%) rotate(10deg);
  opacity: 0.92;
  mix-blend-mode: overlay;
  transition:
    transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1),
    opacity 0.35s cubic-bezier(0.25, 0.8, 0.25, 1);
  pointer-events: none;
}

.thought-card:hover .protocol-badge::after {
  transform: translateX(38%) rotate(10deg);
  opacity: 1;
}

.protocol-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}

.protocol-date {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgb(0 0 0 / 0.45);
  white-space: nowrap;
}

.protocol-date-icon {
  width: 14px;
  height: 14px;
  color: rgb(0 0 0 / 0.38);
}

.protocol-meta-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.protocol-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.6);
  border: 1px solid rgb(255 255 255 / 0.72);
  box-shadow: 0 16px 34px rgb(0 0 0 / 6%);
  backdrop-filter: blur(10px);
}

.protocol-meta-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(0 0 0 / 0.55);
}

.protocol-meta-count-icon {
  width: 14px;
  height: 14px;
  color: rgb(0 0 0 / 0.4);
}

.protocol-meta-sep {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.16);
}

.protocol-meta-status {
  font-size: 12px;
  color: rgb(var(--thought-accent-rgb) / 0.85);
  font-weight: 600;
}

.protocol-arrow {
  font-size: 18px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: rgb(var(--thought-accent-rgb) / 0.85);
}

.thought-card:hover .protocol-arrow {
  opacity: 1;
}

.thought-card:hover :deep(.ant-card-body)::after {
  opacity: 1;
}

.protocol-meta-left {
  min-width: 0;
}

.protocol-meta-right {
  flex: 0 0 auto;
}

@media (max-width: 768px) {
  .protocol-top {
    gap: 12px;
    padding-right: 58px;
  }
  .protocol-icon {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    flex-basis: 56px;
  }
  .protocol-icon-img {
    width: 56px;
    height: 56px;
  }
  .protocol-title {
    font-size: calc(var(--font-size-base, 14px) + 2px);
  }
  .protocol-desc {
    -webkit-line-clamp: 2;
  }
}

.event-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ant-color-primary, #1677ff);
  background: var(--ant-color-primary-bg, #e6f4ff);
  border-radius: 50%;
  position: relative;
}

.event-badge::after {
  content: '›';
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  color: rgb(var(--thought-accent-rgb) / 0.8);
}

.thought-card:hover .event-badge::after {
  opacity: 1;
}

.type-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  cursor: pointer;
  user-select: none;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(0 0 0 / 6%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 55%);
}

.type-item.is-active {
  border-color: rgb(var(--thought-accent-rgb) / 0.35);
  box-shadow:
    0 10px 24px rgb(var(--thought-accent-rgb) / 0.14),
    inset 0 0 0 1px rgb(255 255 255 / 55%);
}

.type-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgb(255 255 255 / 55%);
  border: 1px solid rgb(0 0 0 / 6%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.type-title {
  font-size: 13px;
  font-weight: 700;
  color: rgb(0 0 0 / 0.72);
}

@media (max-width: 768px) {
  .type-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Modal 内部样式 */
.thought-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  color: rgb(0 0 0 / 0.78);
}

.thought-detail-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.thought-detail-tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  color: rgb(var(--thought-accent-rgb) / 0.92);
  background: rgb(var(--thought-accent-rgb) / 0.12);
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.18);
  box-shadow:
    0 10px 18px rgb(var(--thought-accent-rgb) / 0.1),
    inset 0 1px 0 rgb(255 255 255 / 0.85);
}

.thought-detail-tag.is-status {
  background: rgb(var(--thought-accent-rgb) / 0.18);
}

.thought-detail-time {
  margin-left: auto;
  font-size: 13px;
  color: rgb(0 0 0 / 0.48);
  white-space: nowrap;
}

.thought-detail-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.42;
  color: rgb(0 0 0 / 0.82);
  letter-spacing: 0;
  word-break: break-word;
}

.thought-detail-title.is-editable,
.thought-detail-content.is-editable {
  cursor: text;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.thought-detail-title.is-editable {
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 12px;
}

.thought-detail-title.is-editable:hover {
  background: rgb(var(--thought-accent-rgb) / 0.06);
}

.thought-detail-title-input {
  min-height: 42px;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.42;
}

.thought-detail-section {
  display: grid;
  gap: 8px;
}

.thought-detail-section-title {
  font-size: 13px;
  font-weight: 800;
  color: rgb(0 0 0 / 0.58);
}

.thought-detail-content {
  min-height: 132px;
  padding: 16px 18px;
  border-radius: 16px;
  font-size: 16px;
  line-height: 1.75;
  color: rgb(0 0 0 / 0.72);
  white-space: pre-wrap;
  word-break: break-word;
  background:
    linear-gradient(
      145deg,
      rgb(255 255 255 / 0.78) 0%,
      rgb(var(--thought-accent-rgb) / 0.08) 100%
    );
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.12);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.8),
    0 12px 28px rgb(0 0 0 / 0.04);
}

.thought-detail-content.is-editable:hover {
  border-color: rgb(var(--thought-accent-rgb) / 0.28);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.8),
    0 14px 30px rgb(var(--thought-accent-rgb) / 0.08);
}

.thought-detail-content-editor {
  min-height: 132px;
  padding: 16px 18px;
  border-radius: 16px;
  font-size: 16px;
  line-height: 1.75;
  background:
    linear-gradient(
      145deg,
      rgb(255 255 255 / 0.86) 0%,
      rgb(var(--thought-accent-rgb) / 0.08) 100%
    );
}

.thought-detail-summary {
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 13px;
  color: rgb(0 0 0 / 0.52);
  background: rgb(255 255 255 / 0.62);
  border: 1px solid rgb(0 0 0 / 0.06);
}

.thought-detail-events {
  display: grid;
  gap: 10px;
}

.thought-detail-event {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgb(128 128 128 / 4%);
  border: 1px solid rgb(0 0 0 / 0.04);
}

.thought-detail-event-content {
  font-size: 14px;
  line-height: 1.6;
  color: rgb(0 0 0 / 0.7);
  white-space: pre-wrap;
  word-break: break-word;
}

.thought-detail-event-time {
  margin-top: 6px;
  font-size: 12px;
  color: rgb(0 0 0 / 0.42);
}

.thought-detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid rgb(0 0 0 / 0.06);
}

@media (max-width: 768px) {
  .thought-detail-time {
    width: 100%;
    margin-left: 0;
  }

  .thought-detail-title {
    font-size: 20px;
  }

  .thought-detail-title-input {
    font-size: 20px;
  }

  .thought-detail-footer {
    justify-content: stretch;
  }

  .thought-detail-footer :deep(.ant-btn) {
    flex: 1;
  }
}

.modal-status-capsule {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.78);
  border: 1px solid rgb(0 0 0 / 0.06);
  box-shadow:
    0 10px 22px rgb(0 0 0 / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.8);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}

.is-create-form :deep(.ant-form-item-label > label) {
  font-size: 15px;
  font-weight: 700;
}

.is-create-form :deep(.ant-input) {
  min-height: 44px;
  font-size: 16px;
}

.is-create-form .modal-capsule-item {
  min-height: 44px;
}

.modal-type-capsule {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 16px;
  background: rgb(255 255 255 / 0.62);
  border: 1px solid rgb(0 0 0 / 0.06);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.75);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.modal-type-capsule::-webkit-scrollbar {
  display: none;
}

.modal-type-capsule .modal-capsule-item {
  padding: 6px 10px;
  font-size: 12px;
}

.modal-capsule-item {
  appearance: none;
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  color: rgb(0 0 0 / 0.72);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.modal-capsule-item:hover {
  background: rgb(255 255 255 / 0.55);
}

.modal-capsule-item.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.modal-capsule-item.is-disabled:hover {
  background: transparent;
}

.modal-capsule-item.is-active {
  background: rgb(var(--thought-accent-rgb) / 0.18);
  color: rgb(var(--thought-accent-rgb) / 0.92);
  box-shadow:
    0 10px 18px rgb(var(--thought-accent-rgb) / 0.22),
    0 8px 16px rgb(0 0 0 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
  transform: translateY(-1px);
}

.modal-divider {
  margin: 4px 0 10px;
  height: 1px;
  background: rgb(0 0 0 / 0.06);
}

.modal-extra-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgb(255 255 255 / 0.62);
  border: 1px solid rgb(0 0 0 / 0.06);
  cursor: pointer;
  user-select: none;
}

.modal-extra-title {
  font-size: 13px;
  font-weight: 800;
  color: rgb(0 0 0 / 0.74);
}

.modal-extra-meta {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: rgb(0 0 0 / 0.48);
}

.modal-extra-arrow {
  flex: 0 0 auto;
  font-size: 14px;
  line-height: 1;
  color: rgb(0 0 0 / 0.42);
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

.modal-extra-arrow.is-open {
  transform: rotate(180deg);
}

.modal-extra-body {
  margin-top: 10px;
}

.modal-content-form-item {
  margin-bottom: 14px;
}

.modern-form .content-textarea {
  padding: 12px 16px;
  font-size: 16px;
  line-height: 1.6;
  resize: none;
  background: rgb(128 128 128 / 4%);
  border-radius: 12px;
}

.modern-form .content-textarea:focus {
  background: rgb(128 128 128 / 8%);
}

.events-section {
  margin-top: 8px;
}

.events-header {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.65;
}

.event-item {
  padding: 12px 16px;
  margin-bottom: 12px;
  background: rgb(128 128 128 / 4%);
  border-radius: 12px;
  transition: background 0.3s;
}

.event-item:hover {
  background: rgb(128 128 128 / 8%);
}

.event-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.event-input {
  padding: 4px 8px;
  font-size: 14px;
  background: transparent !important;
}

.event-time {
  margin-top: 6px;
  margin-left: 8px;
  font-size: 12px;
  opacity: 0.45;
}

.add-event-btn {
  border-radius: 12px;
  opacity: 0.8;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid rgb(0 0 0 / 0.06);
}

.modal-footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 768px) {
  :global(.thought-create-modal-wrap) {
    overflow: hidden;
  }

  :global(.thought-create-modal-wrap .ant-modal) {
    top: 0;
    width: 100% !important;
    max-width: none;
    height: 100%;
    padding-bottom: 0;
    margin: 0;
  }

  :global(.thought-create-modal-wrap .ant-modal-content) {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    padding: 0;
    border-radius: 0;
  }

  :global(.thought-create-modal-wrap .ant-modal-header) {
    flex: 0 0 auto;
    padding: 18px 16px 12px;
    margin-bottom: 0;
  }

  :global(.thought-create-modal-wrap .ant-modal-close) {
    top: 12px;
    right: 10px;
    width: 44px;
    height: 44px;
  }

  :global(.thought-create-modal-wrap .ant-modal-body) {
    flex: 1 1 auto;
    min-height: 0;
    padding: 12px 16px 0;
    overflow-y: auto;
  }

  .is-create-form {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  .is-create-form :deep(.ant-form-item) {
    margin-bottom: 18px;
  }

  .is-create-form :deep(.ant-form-item-label) {
    padding-bottom: 8px;
  }

  .is-create-form .modal-status-capsule {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
    gap: 6px;
    padding: 6px;
    border-radius: 16px;
  }

  .is-create-form .modal-status-capsule .modal-capsule-item {
    flex: 1 1 calc(33.333% - 6px);
    padding: 8px 10px;
  }

  .is-create-form .modal-type-capsule {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 8px;
    overflow: visible;
  }

  .is-create-form .modal-type-capsule .modal-capsule-item {
    width: 100%;
    padding: 8px 10px;
    font-size: 14px;
  }

  .is-create-form .modal-divider {
    margin-top: 0;
  }

  .is-create-form .modal-extra-toggle {
    min-height: 48px;
  }

  .is-create-form .modal-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin-top: auto;
    padding: 14px 0 16px;
    background: var(--ant-color-bg-elevated, #fff);
  }

  .is-create-form .modal-footer-left:empty {
    display: none;
  }

  .is-create-form .modal-footer-right {
    width: 100%;
  }

  .is-create-form .modal-footer-right :deep(.ant-btn) {
    flex: 1;
    min-height: 44px;
  }
}

@media (max-width: 480px) {
  .thought-statistics-core {
    grid-template-columns: 1fr;
  }

  .thought-secondary-stat-strip {
    grid-template-columns: 1fr;
  }

  .thought-primary-stat-card-value {
    font-size: 30px;
  }

  .thought-trend-select {
    flex-basis: 100%;
  }
}

/* 隐藏原生 textarea 滚动条但保留功能 */
textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: rgb(128 128 128 / 20%);
  border-radius: 4px;
}

textarea:hover::-webkit-scrollbar-thumb {
  background: rgb(128 128 128 / 40%);
}
</style>
