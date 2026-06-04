<script lang="ts" setup>
import type {
  McpToolCallLogItem,
  McpToolCallResult,
  McpToolConfigPayload,
  McpToolItem,
} from '#/api/core/mcp';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  CodeOutlined,
  CopyOutlined,
  EditOutlined,
  FileSearchOutlined,
  MoreOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Dropdown,
  Empty,
  Form,
  Input,
  InputNumber,
  Menu,
  MenuItem,
  message,
  Modal,
  Select,
  Skeleton,
  Switch,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  callMcpToolApi,
  getMcpToolLogsApi,
  getMcpToolsApi,
  updateMcpToolConfigApi,
  updateMcpToolStatusApi,
} from '#/api/core/mcp';

defineOptions({ name: 'McpTools' });

const userStore = useUserStore();
const isAdmin = computed(() =>
  (userStore.userInfo?.roles ?? []).includes('admin'),
);

const loading = ref(false);
const keyword = ref('');
const selectedGroup = ref<string>();
const tools = ref<McpToolItem[]>([]);

const referenceDrawerOpen = ref(false);
const referenceTool = ref<McpToolItem | null>(null);
const activeReferenceTab = ref('params');
const referenceParamKeyword = ref('');
const referenceRequiredOnly = ref(false);
const referenceComplexOnly = ref(false);
const expandedParamKeys = ref<string[]>([]);
const activeExampleMode = ref('default');

const activeTool = ref<McpToolItem | null>(null);
const callDrawerOpen = ref(false);
const callLoading = ref(false);
const activeCallTab = ref('form');
const formArguments = ref<Record<string, any>>({});
const jsonArguments = ref('{}');
const callResult = ref<McpToolCallResult | null>(null);
const callError = ref('');

const configDrawerOpen = ref(false);
const configSaving = ref(false);
const configTool = ref<McpToolItem | null>(null);
const configForm = ref<McpToolConfigPayload>({
  descriptionOverride: '',
  displayName: '',
  groupName: '',
  remark: '',
  sortOrder: 0,
  writeOperation: false,
});

const logDrawerOpen = ref(false);
const logLoading = ref(false);
const logTool = ref<McpToolItem | null>(null);
const callLogs = ref<McpToolCallLogItem[]>([]);

const groupOptions = computed(() => {
  const groups = new Set<string>();
  for (const tool of tools.value) {
    if (tool.groupName) {
      groups.add(tool.groupName);
    }
  }
  return Array.from(groups)
    .sort((a, b) => a.localeCompare(b))
    .map((group) => ({ label: group, value: group }));
});

const filteredTools = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  return tools.value.filter((tool) => {
    const matchGroup =
      !selectedGroup.value || tool.groupName === selectedGroup.value;
    const matchKeyword =
      !value ||
      tool.name.toLowerCase().includes(value) ||
      (tool.displayName || '').toLowerCase().includes(value) ||
      (tool.description || '').toLowerCase().includes(value);
    return matchGroup && matchKeyword;
  });
});

const groupSummary = computed(() => {
  const summary = new Map<string, number>();
  for (const tool of tools.value) {
    const group = tool.groupName || '未分组';
    summary.set(group, (summary.get(group) || 0) + 1);
  }
  return Array.from(summary.entries()).map(([name, count]) => ({ count, name }));
});

async function fetchTools() {
  loading.value = true;
  try {
    tools.value = await getMcpToolsApi();
  } catch (error) {
    console.error(error);
    message.error('获取 MCP 工具列表失败');
  } finally {
    loading.value = false;
  }
}

function getParamEntries(tool: McpToolItem) {
  return Object.entries(tool.inputSchema?.properties || {}).map(
    ([name, schema]) => ({ name, schema: schema as Record<string, any> }),
  );
}

function getParamType(schema: Record<string, any>) {
  if (Array.isArray(schema.type)) {
    return schema.type.join(' | ');
  }
  return schema.type || schema.$ref || 'object';
}

function normalizeParamType(schema: Record<string, any>) {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (type === 'integer') {
    return 'number';
  }
  return type || 'object';
}

function isBasicParam(schema: Record<string, any>) {
  return ['boolean', 'integer', 'number', 'string'].includes(
    normalizeParamType(schema),
  );
}

function getDefaultValue(schema: Record<string, any>) {
  const type = normalizeParamType(schema);
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (type === 'boolean') {
    return false;
  }
  if (type === 'number') {
    return undefined;
  }
  if (type === 'array') {
    return [];
  }
  if (type === 'object') {
    return {};
  }
  return '';
}

function buildInitialArguments(tool: McpToolItem) {
  const result: Record<string, any> = {};
  for (const param of getParamEntries(tool)) {
    result[param.name] = getDefaultValue(param.schema);
  }
  return result;
}

function buildExampleArguments(tool: McpToolItem) {
  const result: Record<string, any> = {};
  for (const param of getParamEntries(tool)) {
    const value = getDefaultValue(param.schema);
    result[param.name] = value === undefined ? null : value;
  }
  return result;
}

function isRequired(tool: McpToolItem, paramName: string) {
  return (tool.inputSchema?.required || []).includes(paramName);
}

function canCallTool(tool: McpToolItem) {
  return tool.enabled && tool.runtimeRegistered;
}

function getToolPrimaryStatus(tool: McpToolItem) {
  if (!tool.configured) {
    return { color: 'orange', text: '配置缺失', type: 'missing-config' };
  }
  if (!tool.enabled || !tool.runtimeRegistered) {
    return { color: 'red', text: '不可调用', type: 'unavailable' };
  }
  return { color: 'green', text: '可调用', type: 'available' };
}

function getCallDisabledText(tool: McpToolItem) {
  if (!tool.runtimeRegistered) {
    return '工具未在当前运行时注册';
  }
  if (!tool.enabled) {
    return '工具已停用';
  }
  return '';
}

function getDefaultDisplay(schema: Record<string, any>) {
  if (schema.default === undefined) {
    return '-';
  }
  if (typeof schema.default === 'object') {
    return JSON.stringify(schema.default);
  }
  return String(schema.default);
}

function getNestedProperties(schema: Record<string, any>) {
  if (schema.properties) {
    return schema.properties as Record<string, any>;
  }
  if (schema.items?.properties) {
    return schema.items.properties as Record<string, any>;
  }
  return {};
}

function isComplexSchema(schema: Record<string, any>) {
  const type = normalizeParamType(schema);
  return (
    type === 'array' ||
    type === 'object' ||
    Boolean(schema.properties) ||
    Boolean(schema.items?.properties)
  );
}

function getNestedParamRows(param: {
  name: string;
  schema: Record<string, any>;
}) {
  return Object.entries(getNestedProperties(param.schema)).map(
    ([name, schema]) => {
      const fieldSchema = schema as Record<string, any>;
      return {
        description: fieldSchema.description || '暂无说明',
        name,
        path: `${param.name}.${name}`,
        type: getParamType(fieldSchema),
      };
    },
  );
}

function getReferenceParamRows(tool: McpToolItem) {
  return getParamEntries(tool).map((param) => {
    const nestedRows = getNestedParamRows(param);
    return {
      complex: isComplexSchema(param.schema),
      defaultValue: getDefaultDisplay(param.schema),
      description: param.schema.description || '暂无说明',
      group: getParamGroup(param.name),
      name: param.name,
      nestedRows,
      required: isRequired(tool, param.name),
      schema: param.schema,
      type: getParamType(param.schema),
    };
  });
}

function matchParamKeyword(param: ReturnType<typeof getReferenceParamRows>[number]) {
  const keyword = referenceParamKeyword.value.trim().toLowerCase();
  if (!keyword) {
    return true;
  }
  const targets = [
    param.name,
    param.type,
    param.description,
    ...param.nestedRows.flatMap((row) => [
      row.name,
      row.path,
      row.type,
      row.description,
    ]),
  ];
  return targets.some((item) => item.toLowerCase().includes(keyword));
}

function getFilteredReferenceParamRows(tool: McpToolItem) {
  return getReferenceParamRows(tool).filter((param) => {
    if (referenceRequiredOnly.value && !param.required) {
      return false;
    }
    if (referenceComplexOnly.value && !param.complex) {
      return false;
    }
    return matchParamKeyword(param);
  });
}

function getParamGroup(name: string) {
  if (
    [
      'id',
      'idempotencyKey',
      'dishName',
      'category',
      'mealType',
      'status',
      'tags',
      'difficulty',
      'rating',
      'successLevel',
      'subject',
      'content',
      'themeKey',
      'title',
      'description',
      'categoryId',
      'page',
      'pageSize',
      'keyword',
    ].includes(name)
  ) {
    return '基础字段';
  }
  if (
    [
      'cookDate',
      'startDate',
      'endDate',
      'date',
      'startTime',
      'endTime',
      'prepMinutes',
      'cookMinutes',
      'totalMinutes',
    ].includes(name)
  ) {
    return '时间字段';
  }
  if (['ingredients'].includes(name)) {
    return '材料字段';
  }
  if (['steps'].includes(name)) {
    return '步骤字段';
  }
  if (
    [
      'tasteDescription',
      'problems',
      'summary',
      'briefSummary',
      'nextImprove',
      'worthRedo',
      'nextTrySuggestion',
      'toImprove',
      'events',
      'exercises',
    ].includes(name)
  ) {
    return '复盘字段';
  }
  return '其他字段';
}

const referenceGroupOrder = [
  '基础字段',
  '时间字段',
  '材料字段',
  '步骤字段',
  '复盘字段',
  '其他字段',
];

function getReferenceParamGroups(tool: McpToolItem) {
  const rows = getFilteredReferenceParamRows(tool);
  return referenceGroupOrder
    .map((name) => ({
      name,
      rows: rows.filter((row) => row.group === name),
    }))
    .filter((group) => group.rows.length > 0);
}

function shouldShowReferenceCatalog(tool: McpToolItem) {
  return getReferenceParamRows(tool).length > 15;
}

function toggleParamExpanded(name: string) {
  if (expandedParamKeys.value.includes(name)) {
    expandedParamKeys.value = expandedParamKeys.value.filter((key) => key !== name);
    return;
  }
  expandedParamKeys.value = [...expandedParamKeys.value, name];
}

function expandAllParams(tool: McpToolItem) {
  expandedParamKeys.value = getReferenceParamRows(tool)
    .filter((param) => param.complex)
    .map((param) => param.name);
}

function collapseAllParams() {
  expandedParamKeys.value = [];
}

function scrollToParamGroup(name: string) {
  document
    .querySelector(`[data-param-group="${name}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getReferenceExampleModes(tool: McpToolItem) {
  if (tool.name === 'food_record_save') {
    return [
      { label: '创建示例', value: 'create' },
      { label: '更新示例', value: 'update' },
    ];
  }
  return [{ label: '示例', value: 'default' }];
}

function buildReferenceExample(tool: McpToolItem, mode = activeExampleMode.value) {
  if (tool.name === 'food_record_query') {
    return {
      category: '',
      endDate: '2026-06-04',
      keyword: '',
      mealType: '',
      page: 1,
      pageSize: 20,
      rating: null,
      startDate: '2026-06-01',
      status: '',
      tags: '',
      toImprove: false,
      worthRedo: false,
    };
  }
  if (tool.name === 'food_record_save') {
    return {
      id: mode === 'update' ? 1001 : null,
      idempotencyKey: `food-record-2026-06-04-${mode}`,
      dishName: mode === 'update' ? '香煎鸡胸肉（优化版）' : '香煎鸡胸肉',
      category: '家常菜',
      mealType: '午餐',
      cookDate: '2026-06-04',
      status: 'done',
      tags: '高蛋白,减脂,快手菜',
      difficulty: '简单',
      rating: 8.6,
      successLevel: '成功',
      prepMinutes: 8,
      cookMinutes: 12,
      totalMinutes: 20,
      ingredients: [
        {
          name: '鸡胸肉',
          quantity: '200',
          remark: '吸干水分',
          sortOrder: 1,
          unit: '克',
        },
        {
          name: '黑胡椒',
          quantity: '适量',
          remark: '两面均匀撒开',
          sortOrder: 2,
          unit: '',
        },
      ],
      steps: [
        {
          description: '加入生抽和黑胡椒，抓匀后腌制。',
          durationMinutes: 5,
          sortOrder: 1,
          stepNo: 1,
          title: '腌制',
        },
        {
          description: '平底锅少油，中小火两面煎熟。',
          durationMinutes: 12,
          sortOrder: 2,
          stepNo: 2,
          title: '煎制',
        },
      ],
      tasteDescription: '咸香适中，肉质不柴。',
      problems: '鸡胸肉太厚时内部不易熟。',
      summary: '整体成功，适合作为午餐高蛋白主菜。',
      briefSummary: '咸香快手的减脂鸡胸肉',
      nextImprove: '下次可以提前拍薄鸡胸肉。',
      worthRedo: true,
      nextTrySuggestion: '尝试搭配西兰花或土豆泥。',
    };
  }
  if (tool.name === 'time_record_queryByDateRange') {
    return {
      endDate: '2026-06-04',
      startDate: '2026-06-01',
    };
  }
  if (tool.name === 'time_record_save') {
    return {
      categoryId: 'replace-with-category-id',
      date: '2026-06-04',
      description: '午间做饭和复盘记录',
      endTime: 780,
      exercises: [
        {
          description: '饭后深蹲',
          exerciseCount: 30,
          exerciseDate: '2026-06-04',
          exerciseTypeId: 'replace-with-exercise-type-id',
          id: null,
        },
      ],
      id: null,
      idempotencyKey: 'time-record-2026-06-04-001',
      startTime: 720,
      title: '午餐准备',
    };
  }
  if (tool.name === 'thought_save') {
    return {
      content: '今天把 MCP 工具参考和模拟调用流程打通，后续可以继续补更多业务示例。',
      events: [
        {
          content: '完成 MCP 工具参考中心阶段 2 规划',
        },
      ],
      idempotencyKey: 'thought-2026-06-04-001',
      status: 'pending',
      subject: 'MCP 工具体验优化',
      themeKey: 'blue',
    };
  }
  return buildExampleArguments(tool);
}

function getCurrentReferenceExample() {
  if (!referenceTool.value) {
    return {};
  }
  return buildReferenceExample(referenceTool.value, activeExampleMode.value);
}

function fillExampleToCallDrawer() {
  if (!referenceTool.value) {
    return;
  }
  const example = getCurrentReferenceExample();
  activeTool.value = referenceTool.value;
  activeCallTab.value = 'json';
  callResult.value = null;
  callError.value = '';
  formArguments.value = example;
  jsonArguments.value = JSON.stringify(example, null, 2);
  referenceDrawerOpen.value = false;
  callDrawerOpen.value = true;
}

function getCallGuide(tool: McpToolItem) {
  const guides: Record<string, {
    combos: string[];
    notes: string[];
    usage: string;
  }> = {
    food_record_query: {
      combos: ['按日期范围查询', '按菜名 keyword 查询', '按 toImprove=true 查询待优化记录'],
      notes: ['这是只读工具，不会修改数据。', '条件越多，返回结果越少。'],
      usage: '用于查询当前用户的美食记录摘要，适合让 Agent 回顾历史做饭记录。',
    },
    food_record_save: {
      combos: ['创建时 id 传 null', '更新时 id 替换为已有记录 ID', 'ingredients 和 steps 可传数组结构'],
      notes: ['这是写操作，会真实新增或更新数据。', '建议传 idempotencyKey，避免重复创建。'],
      usage: '用于保存一条美食记录文字内容，支持材料、步骤、评价和复盘。',
    },
    thought_save: {
      combos: ['只传 content 快速保存', '传 subject + events 记录结构化闪念'],
      notes: ['这是写操作，会真实写入闪念。', 'events 可为空数组或不传。'],
      usage: '用于保存一条想法，并可附带多个关联事件。',
    },
    time_record_queryByDateRange: {
      combos: ['传 startDate 和 endDate 查询指定范围'],
      notes: ['这是只读工具，不会修改数据。', '日期格式必须是 yyyy-MM-dd。'],
      usage: '用于查询指定日期范围内的时间记录。',
    },
    time_record_save: {
      combos: ['传 categoryId + date + startTime + endTime 保存时间块', '需要联动练习时传 exercises'],
      notes: ['这是写操作，会真实写入时间记录。', 'startTime/endTime 是从 0:00 开始的分钟数。'],
      usage: '用于保存时间记录，可附带练习记录。',
    },
  };
  return (
    guides[tool.name] || {
      combos: ['先使用 JSON 示例验证参数结构', '再按 Schema 调整字段值'],
      notes: [
        tool.writeOperation ? '这是写操作，会真实修改数据。' : '这是只读工具。',
        '执行前建议确认必填参数和日期格式。',
      ],
      usage: tool.description || '用于通过 MCP 调用当前工具。',
    }
  );
}

function openReferenceDrawer(tool: McpToolItem) {
  referenceTool.value = tool;
  activeReferenceTab.value = 'params';
  referenceParamKeyword.value = '';
  referenceRequiredOnly.value = false;
  referenceComplexOnly.value = false;
  expandedParamKeys.value = [];
  activeExampleMode.value = getReferenceExampleModes(tool)[0]?.value || 'default';
  referenceDrawerOpen.value = true;
}

async function copySchema(tool: McpToolItem) {
  const content = JSON.stringify(tool.inputSchema || {}, null, 2);
  try {
    await copyText(content);
    message.success('Schema 已复制');
  } catch {
    message.error('复制失败，请手动复制');
  }
}

async function copyReferenceSchema() {
  if (!referenceTool.value) {
    return;
  }
  await copySchema(referenceTool.value);
}

async function copyReferenceExample() {
  if (!referenceTool.value) {
    return;
  }
  try {
    await copyText(
      JSON.stringify(buildExampleArguments(referenceTool.value), null, 2),
    );
    message.success('JSON 示例已复制');
  } catch {
    message.error('复制失败，请手动复制');
  }
}

async function copyText(content: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(content);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    const success = document.execCommand('copy');
    if (!success) {
      throw new Error('execCommand copy failed');
    }
  } finally {
    textarea.remove();
  }
}

function openCallDrawer(tool: McpToolItem) {
  activeTool.value = tool;
  activeCallTab.value = 'form';
  callResult.value = null;
  callError.value = '';
  formArguments.value = buildInitialArguments(tool);
  syncJsonFromForm();
  callDrawerOpen.value = true;
}

function syncJsonFromForm() {
  jsonArguments.value = JSON.stringify(formArguments.value, null, 2);
}

function syncFormFromJson() {
  try {
    const parsed = JSON.parse(jsonArguments.value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('arguments must be object');
    }
    formArguments.value = parsed;
    callError.value = '';
  } catch {
    callError.value = 'arguments 必须是合法 JSON 对象';
  }
}

function updateFormValue(name: string, value: any) {
  formArguments.value = { ...formArguments.value, [name]: value };
  syncJsonFromForm();
}

async function executeCall() {
  if (!activeTool.value) {
    return;
  }
  syncFormFromJson();
  if (callError.value) {
    message.error(callError.value);
    return;
  }
  if (!canCallTool(activeTool.value)) {
    callError.value = getCallDisabledText(activeTool.value);
    message.warning(callError.value);
    return;
  }
  if (activeTool.value.writeOperation) {
    Modal.confirm({
      cancelText: '取消',
      content: '该工具可能写入或修改数据，本次调用会真实执行。',
      okText: '确认执行',
      onOk: runCall,
      title: '确认执行写操作工具',
    });
    return;
  }
  await runCall();
}

async function runCall() {
  if (!activeTool.value) {
    return;
  }
  callLoading.value = true;
  callResult.value = null;
  callError.value = '';
  try {
    const result = await callMcpToolApi(activeTool.value.name, formArguments.value);
    callResult.value = result;
    if (result?.isError) {
      callError.value = getResultText(result) || '工具调用失败';
      message.error(callError.value);
    } else {
      message.success('工具调用完成');
    }
  } catch (error: any) {
    console.error(error);
    callError.value =
      error?.response?.data?.result || error?.message || '工具调用失败';
    message.error(callError.value);
  } finally {
    callLoading.value = false;
  }
}

function openConfigDrawer(tool: McpToolItem) {
  configTool.value = tool;
  configForm.value = {
    descriptionOverride:
      tool.descriptionSource === 'override' ? tool.description || '' : '',
    displayName: tool.displayName || tool.name,
    groupName: tool.groupName || '',
    remark: tool.remark || '',
    sortOrder: tool.sortOrder || 0,
    writeOperation: Boolean(tool.writeOperation),
  };
  configDrawerOpen.value = true;
}

async function saveConfig() {
  if (!configTool.value) {
    return;
  }
  configSaving.value = true;
  try {
    await updateMcpToolConfigApi(configTool.value.name, configForm.value);
    message.success(configTool.value.configured ? '配置已更新' : '配置已创建');
    configDrawerOpen.value = false;
    await fetchTools();
  } catch (error: any) {
    console.error(error);
    message.error(error?.response?.data?.result || '保存配置失败');
  } finally {
    configSaving.value = false;
  }
}

async function updateStatus(tool: McpToolItem, checked: boolean) {
  try {
    await updateMcpToolStatusApi(tool.name, checked);
    message.success(checked ? '工具已启用' : '工具已停用');
    await fetchTools();
  } catch (error: any) {
    console.error(error);
    message.error(error?.response?.data?.result || '更新状态失败');
  }
}

async function openLogDrawer(tool: McpToolItem) {
  logTool.value = tool;
  callLogs.value = [];
  logDrawerOpen.value = true;
  logLoading.value = true;
  try {
    callLogs.value = await getMcpToolLogsApi(tool.name, 50);
  } catch (error: any) {
    console.error(error);
    message.error(error?.response?.data?.result || '获取调用日志失败');
  } finally {
    logLoading.value = false;
  }
}

function formatJson(value: any) {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

function getResultText(result: McpToolCallResult) {
  return (result.content || [])
    .map((item) => item.text || JSON.stringify(item))
    .filter(Boolean)
    .join('\n');
}

onMounted(fetchTools);
</script>

<template>
  <Page auto-content-height>
    <div class="mcp-tools-page">
      <div class="page-header">
        <div class="header-main">
          <h2>MCP 工具</h2>
          <div class="summary-line">
            <span>共 {{ tools.length }} 个工具</span>
            <span v-for="item in groupSummary" :key="item.name">
              {{ item.name }} {{ item.count }}
            </span>
          </div>
        </div>
        <div class="header-controls">
          <Select
            v-model:value="selectedGroup"
            allow-clear
            class="group-filter"
            :options="groupOptions"
            placeholder="全部分组"
          />
          <Input
            v-model:value="keyword"
            allow-clear
            class="search-input"
            placeholder="搜索工具名称或描述"
          >
            <template #prefix><SearchOutlined /></template>
          </Input>
        </div>
      </div>

      <Skeleton v-if="loading" active :paragraph="{ rows: 8 }" />
      <Empty
        v-else-if="filteredTools.length === 0"
        class="empty-state"
        description="暂无匹配的 MCP 工具"
      />
      <div v-else class="tool-grid">
        <Card
          v-for="tool in filteredTools"
          :key="tool.name"
          class="tool-card"
          :class="{ muted: !tool.enabled || !tool.runtimeRegistered }"
          :bordered="false"
        >
          <div class="tool-card-head">
            <div class="tool-name-wrap">
              <CodeOutlined class="tool-icon" />
              <div class="tool-title-stack">
                <Tooltip :title="tool.displayName || tool.name">
                  <span class="tool-name">{{ tool.displayName || tool.name }}</span>
                </Tooltip>
                <Tooltip
                  v-if="tool.displayName && tool.displayName !== tool.name"
                  :title="tool.name"
                >
                  <span class="tool-code-name">{{ tool.name }}</span>
                </Tooltip>
              </div>
            </div>
            <div class="head-tags">
              <span class="param-count-text">{{ tool.paramCount }} 参数</span>
            </div>
          </div>

          <div class="tool-meta-row">
            <span>{{ tool.groupName || '未分组' }}</span>
            <span>·</span>
            <span :class="{ 'write-operation-text': tool.writeOperation }">
              {{ tool.writeOperation ? '写操作' : '读操作' }}
            </span>
            <span>·</span>
            <span>{{ tool.authRequired ? '需登录' : '无需登录' }}</span>
            <span>·</span>
            <span>{{ tool.runtimeRegistered ? '已注册' : '未注册' }}</span>
          </div>

          <Tooltip :title="tool.description || '暂无描述'">
            <p class="tool-description">{{ tool.description || '暂无描述' }}</p>
          </Tooltip>

          <button
            v-if="!tool.configured && isAdmin"
            class="config-status config-status-action"
            type="button"
            @click="openConfigDrawer(tool)"
          >
            配置缺失
          </button>
          <span v-else-if="!tool.configured" class="config-status">
            配置缺失
          </span>

          <div class="card-actions">
            <div v-if="isAdmin" class="status-switch">
              <span>启用</span>
              <Switch
                :checked="tool.enabled"
                size="small"
                @change="(checked) => updateStatus(tool, Boolean(checked))"
              />
            </div>

            <div class="primary-actions">
              <Button size="small" type="link" @click="openReferenceDrawer(tool)">
                <template #icon><FileSearchOutlined /></template>
                查看参考
              </Button>
              <Tooltip :title="getCallDisabledText(tool)">
                <Button
                  :disabled="!canCallTool(tool)"
                  size="small"
                  type="primary"
                  @click="openCallDrawer(tool)"
                >
                  <template #icon><PlayCircleOutlined /></template>
                  模拟调用
                </Button>
              </Tooltip>
              <Dropdown v-if="isAdmin" :trigger="['click']">
                <Button size="small" type="text" title="更多操作">
                  <template #icon><MoreOutlined /></template>
                </Button>
                <template #overlay>
                  <Menu>
                    <MenuItem key="config" @click="openConfigDrawer(tool)">
                      <EditOutlined />
                      {{ tool.configured ? '编辑配置' : '创建配置' }}
                    </MenuItem>
                    <MenuItem key="logs" @click="openLogDrawer(tool)">
                      <FileSearchOutlined />
                      调用日志
                    </MenuItem>
                  </Menu>
                </template>
              </Dropdown>
            </div>
          </div>
        </Card>
      </div>
    </div>

    <Drawer
      v-model:open="referenceDrawerOpen"
      destroy-on-close
      placement="right"
      root-class-name="reference-drawer"
      title="工具参考"
      width="min(980px, 90vw)"
    >
      <template v-if="referenceTool">
        <div class="reference-header">
          <div class="reference-title-row">
            <span class="drawer-tool-name">{{ referenceTool.name }}</span>
            <Tag :color="referenceTool.writeOperation ? 'red' : 'green'">
              {{ referenceTool.writeOperation ? '写操作' : '读操作' }}
            </Tag>
            <Tag>{{ referenceTool.authRequired ? '需登录' : '无需登录' }}</Tag>
            <Tag :color="getToolPrimaryStatus(referenceTool).color">
              {{ getToolPrimaryStatus(referenceTool).text }}
            </Tag>
          </div>
          <div
            v-if="
              referenceTool.displayName &&
              referenceTool.displayName !== referenceTool.name
            "
            class="reference-display-name"
          >
            {{ referenceTool.displayName }}
          </div>
          <p class="reference-description">
            {{ referenceTool.description || '暂无描述' }}
          </p>
          <div class="reference-meta">
            <span>分组：{{ referenceTool.groupName || '未分组' }}</span>
            <span>参数：{{ referenceTool.paramCount }}</span>
            <span>
              运行时：{{ referenceTool.runtimeRegistered ? '已注册' : '未注册' }}
            </span>
            <span>排序：{{ referenceTool.sortOrder ?? 0 }}</span>
          </div>
        </div>

        <Tabs v-model:active-key="activeReferenceTab" class="reference-tabs">
          <TabPane key="params" tab="参数说明">
            <div class="param-reference-toolbar">
              <Input
                v-model:value="referenceParamKeyword"
                allow-clear
                class="param-search-input"
                placeholder="搜索参数名、类型或说明"
              >
                <template #prefix><SearchOutlined /></template>
              </Input>
              <Checkbox v-model:checked="referenceRequiredOnly">
                只看必填
              </Checkbox>
              <Checkbox v-model:checked="referenceComplexOnly">
                只看复杂参数
              </Checkbox>
              <Button size="small" @click="expandAllParams(referenceTool)">
                展开全部
              </Button>
              <Button size="small" @click="collapseAllParams">
                收起全部
              </Button>
            </div>
            <div
              v-if="getFilteredReferenceParamRows(referenceTool).length === 0"
              class="no-params compact"
            >
              暂无匹配参数
            </div>
            <div
              v-else
              class="param-reference-layout"
              :class="{
                'with-catalog': shouldShowReferenceCatalog(referenceTool),
              }"
            >
              <aside
                v-if="shouldShowReferenceCatalog(referenceTool)"
                class="param-catalog"
              >
                <Button
                  v-for="group in getReferenceParamGroups(referenceTool)"
                  :key="group.name"
                  block
                  size="small"
                  type="text"
                  @click="scrollToParamGroup(group.name)"
                >
                  {{ group.name }} {{ group.rows.length }}
                </Button>
              </aside>

              <div class="param-group-list">
                <section
                  v-for="group in getReferenceParamGroups(referenceTool)"
                  :key="group.name"
                  class="param-group-section"
                  :data-param-group="group.name"
                >
                  <div class="param-group-title">{{ group.name }}</div>
                  <div class="param-table-wrap">
                    <table class="param-table">
                      <thead>
                        <tr>
                          <th>参数名</th>
                          <th>类型</th>
                          <th>必填</th>
                          <th>默认值</th>
                          <th>说明</th>
                        </tr>
                      </thead>
                      <tbody>
                        <template v-for="param in group.rows" :key="param.name">
                          <tr>
                            <td class="param-name-cell">
                              <Button
                                v-if="param.complex"
                                size="small"
                                type="link"
                                @click="toggleParamExpanded(param.name)"
                              >
                                {{
                                  expandedParamKeys.includes(param.name)
                                    ? '收起'
                                    : '展开'
                                }}
                              </Button>
                              <span>{{ param.name }}</span>
                            </td>
                            <td><Tag>{{ param.type }}</Tag></td>
                            <td>
                              <Tag :color="param.required ? 'red' : 'default'">
                                {{ param.required ? '是' : '否' }}
                              </Tag>
                            </td>
                            <td class="param-default-cell">
                              {{ param.defaultValue }}
                            </td>
                            <td>{{ param.description }}</td>
                          </tr>
                          <tr
                            v-if="
                              param.complex &&
                              expandedParamKeys.includes(param.name)
                            "
                            class="nested-param-row"
                          >
                            <td colspan="5">
                              <div
                                v-if="param.nestedRows.length === 0"
                                class="nested-empty"
                              >
                                暂无可展开子字段
                              </div>
                              <div v-else class="nested-param-list">
                                <div
                                  v-for="child in param.nestedRows"
                                  :key="child.path"
                                  class="nested-param-item"
                                >
                                  <span class="nested-param-name">
                                    {{ child.path }}
                                  </span>
                                  <Tag>{{ child.type }}</Tag>
                                  <span class="nested-param-desc">
                                    {{ child.description }}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </template>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </TabPane>

          <TabPane key="example" tab="JSON 示例">
            <div class="reference-tab-toolbar">
              <Select
                v-if="getReferenceExampleModes(referenceTool).length > 1"
                v-model:value="activeExampleMode"
                class="example-mode-select"
                :options="getReferenceExampleModes(referenceTool)"
              />
              <Button size="small" @click="fillExampleToCallDrawer">
                <template #icon><PlayCircleOutlined /></template>
                填入模拟调用
              </Button>
              <Button size="small" type="primary" @click="copyReferenceExample">
                <template #icon><CopyOutlined /></template>
                复制示例
              </Button>
            </div>
            <pre class="code-block reference-code">{{
              formatJson(getCurrentReferenceExample())
            }}</pre>
          </TabPane>

          <TabPane key="schema" tab="Schema">
            <div class="reference-tab-toolbar">
              <Button size="small" type="primary" @click="copyReferenceSchema">
                <template #icon><CopyOutlined /></template>
                复制 Schema
              </Button>
            </div>
            <pre class="code-block reference-code">{{
              JSON.stringify(referenceTool.inputSchema || {}, null, 2)
            }}</pre>
          </TabPane>

          <TabPane key="guide" tab="调用说明">
            <div class="call-guide">
              <Alert
                :message="
                  referenceTool.writeOperation
                    ? '这是写操作工具，模拟调用会真实写入或更新数据。'
                    : '这是只读工具，模拟调用不会修改数据。'
                "
                show-icon
                :type="referenceTool.writeOperation ? 'warning' : 'info'"
              />
              <section class="call-guide-section">
                <div class="section-title">什么时候使用</div>
                <p>{{ getCallGuide(referenceTool).usage }}</p>
              </section>
              <section class="call-guide-section">
                <div class="section-title">常见参数组合</div>
                <ul>
                  <li
                    v-for="item in getCallGuide(referenceTool).combos"
                    :key="item"
                  >
                    {{ item }}
                  </li>
                </ul>
              </section>
              <section class="call-guide-section">
                <div class="section-title">注意事项</div>
                <ul>
                  <li
                    v-for="item in getCallGuide(referenceTool).notes"
                    :key="item"
                  >
                    {{ item }}
                  </li>
                </ul>
              </section>
            </div>
          </TabPane>
        </Tabs>
      </template>
    </Drawer>

    <Drawer
      v-model:open="configDrawerOpen"
      destroy-on-close
      placement="right"
      :title="configTool?.configured ? '编辑工具配置' : '创建工具配置'"
      width="520"
    >
      <template v-if="configTool">
        <div class="drawer-title-row">
          <span class="drawer-tool-name">{{ configTool.name }}</span>
          <Tag v-if="configTool.writeOperation" color="red">写操作</Tag>
          <Tag :color="configTool.enabled ? 'green' : 'red'">
            {{ configTool.enabled ? '已启用' : '已停用' }}
          </Tag>
        </div>
        <Form layout="vertical">
          <Form.Item label="展示名称">
            <Input v-model:value="configForm.displayName" />
          </Form.Item>
          <Form.Item label="分组">
            <Input v-model:value="configForm.groupName" />
          </Form.Item>
          <Form.Item label="描述覆盖">
            <Input.TextArea
              v-model:value="configForm.descriptionOverride"
              :auto-size="{ minRows: 3, maxRows: 6 }"
              placeholder="为空时使用运行时工具描述"
            />
          </Form.Item>
          <Form.Item v-if="isAdmin" label="写操作">
            <Switch v-model:checked="configForm.writeOperation" />
          </Form.Item>
          <Form.Item label="排序">
            <InputNumber v-model:value="configForm.sortOrder" class="w-full" />
          </Form.Item>
          <Form.Item label="备注">
            <Input.TextArea
              v-model:value="configForm.remark"
              :auto-size="{ minRows: 3, maxRows: 6 }"
            />
          </Form.Item>
        </Form>
        <div class="drawer-actions">
          <Button @click="configDrawerOpen = false">取消</Button>
          <Button :loading="configSaving" type="primary" @click="saveConfig">
            保存
          </Button>
        </div>
      </template>
    </Drawer>

    <Drawer
      v-model:open="logDrawerOpen"
      destroy-on-close
      placement="right"
      title="调用日志"
      width="620"
    >
      <template v-if="logTool">
        <div class="drawer-title-row">
          <span class="drawer-tool-name">{{ logTool.name }}</span>
          <Tag v-if="logTool.writeOperation" color="red">写操作</Tag>
        </div>
        <Skeleton v-if="logLoading" active :paragraph="{ rows: 6 }" />
        <Empty
          v-else-if="callLogs.length === 0"
          class="empty-state compact"
          description="暂无调用日志"
        />
        <div v-else class="log-list">
          <div v-for="log in callLogs" :key="log.id" class="log-item">
            <div class="log-head">
              <span>{{ log.createTime || '-' }}</span>
              <Tag :color="log.success ? 'green' : 'red'">
                {{ log.success ? '成功' : '失败' }}
              </Tag>
            </div>
            <div class="log-meta">
              用户 {{ log.userId ?? '-' }} · {{ log.durationMs ?? 0 }} ms
            </div>
            <pre class="code-block compact">{{ log.argumentsSummary || '{}' }}</pre>
            <Alert
              v-if="log.errorMessage"
              :message="log.errorMessage"
              show-icon
              type="error"
            />
          </div>
        </div>
      </template>
    </Drawer>

    <Drawer
      v-model:open="callDrawerOpen"
      destroy-on-close
      placement="right"
      root-class-name="call-debug-drawer"
      title="模拟调用"
      width="min(1180px, 92vw)"
    >
      <template v-if="activeTool">
        <div class="call-drawer-body">
          <div class="drawer-title-row">
            <span class="drawer-tool-name">{{ activeTool.name }}</span>
            <Tag v-if="activeTool.writeOperation" color="red">写操作</Tag>
            <Tag :color="activeTool.enabled ? 'green' : 'red'">
              {{ activeTool.enabled ? '已启用' : '已停用' }}
            </Tag>
          </div>

          <Alert
            class="call-warning"
            :message="
              activeTool.writeOperation
                ? '该工具被标记为写操作，执行前需要再次确认。'
                : '本阶段会真实执行工具，包括保存类工具。'
            "
            show-icon
            :type="activeTool.writeOperation ? 'error' : 'warning'"
          />

          <div class="call-workbench">
            <div class="call-editor-panel">
              <Tabs v-model:active-key="activeCallTab" class="call-tabs">
                <TabPane key="form" tab="表单参数">
                  <section class="drawer-section call-tab-content">
                    <div class="section-head">
                      <div>
                        <div class="section-title">参数速填</div>
                        <div class="section-subtitle">
                          基础类型可直接填写，最终以 JSON 参数为准。
                        </div>
                      </div>
                      <Tag>{{ getParamEntries(activeTool).length }} 参数</Tag>
                    </div>

                    <div
                      v-if="getParamEntries(activeTool).length === 0"
                      class="no-params compact"
                    >
                      该工具无需输入参数
                    </div>
                    <div v-else class="quick-param-list">
                      <div
                        v-for="param in getParamEntries(activeTool)"
                        :key="param.name"
                        class="quick-param-row"
                      >
                        <div class="quick-param-meta">
                          <div class="quick-param-name">
                            <span>{{ param.name }}</span>
                            <Tag
                              v-if="isRequired(activeTool, param.name)"
                              color="red"
                            >
                              必填
                            </Tag>
                            <Tag>{{ getParamType(param.schema) }}</Tag>
                          </div>
                          <div class="quick-param-desc">
                            {{ param.schema.description || '暂无参数说明' }}
                          </div>
                        </div>

                        <template v-if="isBasicParam(param.schema)">
                          <Switch
                            v-if="normalizeParamType(param.schema) === 'boolean'"
                            :checked="Boolean(formArguments[param.name])"
                            @update:checked="
                              (checked) =>
                                updateFormValue(param.name, Boolean(checked))
                            "
                          />
                          <InputNumber
                            v-else-if="
                              normalizeParamType(param.schema) === 'number'
                            "
                            :value="formArguments[param.name]"
                            class="quick-param-control"
                            @update:value="
                              (value) => updateFormValue(param.name, value)
                            "
                          />
                          <Input
                            v-else
                            :value="formArguments[param.name]"
                            class="quick-param-control"
                            @update:value="
                              (value) => updateFormValue(param.name, value)
                            "
                          />
                        </template>
                        <Tag v-else color="orange">请在 JSON 参数中编辑</Tag>
                      </div>
                    </div>
                  </section>
                </TabPane>

                <TabPane key="json" tab="JSON 参数">
                  <section class="drawer-section call-tab-content">
                    <div class="section-head">
                      <div>
                        <div class="section-title">JSON 参数</div>
                        <div class="section-subtitle">
                          可直接编辑完整 arguments JSON，失焦后同步表单参数。
                        </div>
                      </div>
                    </div>
                    <Input.TextArea
                      v-model:value="jsonArguments"
                      :auto-size="{ minRows: 16, maxRows: 24 }"
                      class="json-editor"
                      @blur="syncFormFromJson"
                    />
                  </section>
                </TabPane>

                <TabPane key="schema" tab="Schema">
                  <section class="drawer-section call-tab-content">
                    <div class="section-title">输入 Schema</div>
                    <pre class="code-block schema-code">{{
                      JSON.stringify(activeTool.inputSchema || {}, null, 2)
                    }}</pre>
                  </section>
                </TabPane>
              </Tabs>

              <div class="drawer-actions">
                <Alert
                  v-if="callError && !callResult?.isError"
                  class="call-error"
                  :message="callError"
                  show-icon
                  type="error"
                />
                <Button :loading="callLoading" type="primary" @click="executeCall">
                  执行调用
                </Button>
              </div>
            </div>

            <aside class="call-result-panel">
              <section v-if="callResult" class="drawer-section">
                <div class="section-title">调用结果</div>
                <Alert
                  v-if="callResult.isError"
                  class="mb-3"
                  :message="getResultText(callResult) || '工具调用失败'"
                  show-icon
                  type="error"
                />
                <Alert
                  v-else
                  class="mb-3"
                  message="工具调用成功"
                  show-icon
                  type="success"
                />

                <div v-if="!callResult.isError" class="result-block">
                  <div class="result-label">结构化结果</div>
                  <pre class="code-block result-code">{{
                    formatJson(
                      callResult.structuredContent || getResultText(callResult),
                    )
                  }}</pre>
                </div>

                <div class="result-block">
                  <div class="result-label">原始响应 JSON</div>
                  <pre class="code-block result-code">{{ formatJson(callResult) }}</pre>
                </div>
              </section>
              <div v-else class="call-result-empty">
                执行后在这里查看调用结果
              </div>
            </aside>
          </div>
        </div>
      </template>
    </Drawer>
  </Page>
</template>

<style scoped>
.mcp-tools-page {
  min-height: calc(100vh - 120px);
  padding: 16px;
  background: #f3f5f8;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.header-main h2 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  font-weight: 650;
}

.summary-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  color: #8b95a5;
  font-size: 14px;
}

.header-controls {
  display: flex;
  gap: 10px;
}

.group-filter {
  width: 180px;
}

.search-input {
  width: 320px;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.tool-card {
  display: flex;
  min-height: 190px;
  flex-direction: column;
  border: 1px solid #e7ebf0;
  border-radius: 8px;
  box-shadow: 0 4px 14px rgb(15 23 42 / 5%);
}

.tool-card :deep(.ant-card-body) {
  display: flex;
  height: 100%;
  flex-direction: column;
  padding: 16px;
}

.tool-card.muted {
  opacity: 0.72;
}

.tool-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tool-name-wrap {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.tool-title-stack {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.tool-icon {
  color: #1677ff;
}

.tool-name {
  overflow: hidden;
  color: #1f2937;
  font-size: 16px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-code-name {
  overflow: hidden;
  color: #8b95a5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.head-tags {
  flex-shrink: 0;
  justify-content: flex-end;
}

.param-count-text {
  color: #94a3b8;
  font-size: 12px;
  line-height: 22px;
  white-space: nowrap;
}

.tool-meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  margin-top: 10px;
  color: #8b95a5;
  font-size: 12px;
  line-height: 1.5;
}

.write-operation-text {
  color: #cf1322;
  font-weight: 650;
}

.tool-description {
  display: -webkit-box;
  min-height: 22px;
  margin: 12px 0 10px;
  overflow: hidden;
  color: #334155;
  font-size: 14px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.config-status {
  align-self: flex-start;
  padding: 0;
  margin-bottom: 8px;
  overflow: hidden;
  color: #d46b08;
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: 0;
}

.config-status-action {
  cursor: pointer;
}

.config-status-action:hover {
  color: #ad4e00;
  text-decoration: underline;
}

.status-switch {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
}

.no-params {
  margin-top: 5px;
  color: #94a3b8;
  font-size: 13px;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 8px;
  margin-top: auto;
  border-top: 1px solid #edf0f3;
}

.primary-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

.primary-actions {
  justify-content: flex-end;
}

.empty-state {
  padding: 96px 0;
}

.empty-state.compact {
  padding: 48px 0;
}

.drawer-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.drawer-tool-name {
  color: #1677ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 16px;
  font-weight: 650;
}

.reference-header {
  padding-bottom: 14px;
  margin-bottom: 12px;
  border-bottom: 1px solid #edf0f3;
}

.reference-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.reference-display-name {
  margin-bottom: 8px;
  color: #1f2937;
  font-size: 16px;
  font-weight: 650;
}

.reference-description {
  margin: 0 0 10px;
  color: #334155;
  font-size: 14px;
  line-height: 1.6;
}

.reference-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: #64748b;
  font-size: 13px;
}

.reference-tabs {
  min-width: 0;
}

.reference-tab-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 10px;
}

.param-reference-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.param-search-input {
  width: 280px;
}

.param-reference-layout {
  display: block;
}

.param-reference-layout.with-catalog {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.param-catalog {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.param-group-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
}

.param-group-section {
  scroll-margin-top: 12px;
}

.param-group-title {
  margin-bottom: 8px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.param-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.param-table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 13px;
}

.param-table th,
.param-table td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #edf0f3;
}

.param-table th {
  color: #64748b;
  font-weight: 650;
  background: #f8fafc;
}

.param-table tr:last-child td {
  border-bottom: 0;
}

.param-name-cell,
.param-default-cell {
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.param-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nested-param-row td {
  background: #fbfcfe;
}

.nested-param-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-param-item {
  display: grid;
  grid-template-columns: minmax(160px, 220px) auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #edf0f3;
  border-radius: 6px;
}

.nested-param-name {
  color: #1677ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.nested-param-desc,
.nested-empty {
  color: #64748b;
}

.example-mode-select {
  width: 132px;
}

.reference-code {
  max-height: calc(100vh - 260px);
}

.call-guide {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.call-guide-section {
  padding: 12px;
  background: #fbfcfe;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.call-guide-section p {
  margin: 0;
  color: #334155;
  line-height: 1.6;
}

.call-guide-section ul {
  padding-left: 20px;
  margin: 0;
  color: #334155;
  line-height: 1.8;
}

.drawer-section {
  margin-bottom: 18px;
}

.call-warning {
  margin-bottom: 14px;
}

:global(.call-debug-drawer .ant-drawer-body) {
  padding-bottom: 0;
}

:global(.call-debug-drawer .ant-drawer-content-wrapper) {
  max-width: 100vw;
}

.call-drawer-body {
  min-height: calc(100vh - 110px);
}

.call-workbench {
  display: grid;
  align-items: start;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
}

.call-editor-panel,
.call-result-panel {
  min-width: 0;
}

.call-editor-panel {
  display: flex;
  min-height: calc(100vh - 210px);
  flex-direction: column;
}

.call-result-panel {
  position: sticky;
  top: 0;
  max-height: calc(100vh - 150px);
  overflow: auto;
  padding: 14px;
  background: #fbfcfe;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.call-tabs {
  flex: 1;
  min-height: 0;
}

.call-tab-content {
  min-height: 0;
  margin-bottom: 0;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-title {
  margin-bottom: 10px;
  color: #1f2937;
  font-size: 14px;
  font-weight: 650;
}

.section-head .section-title {
  margin-bottom: 2px;
}

.section-subtitle {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.5;
}

.quick-param-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 330px);
  overflow: auto;
  padding-right: 2px;
}

.quick-param-row {
  display: grid;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) minmax(120px, 42%);
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.quick-param-meta {
  min-width: 0;
}

.quick-param-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 650;
}

.quick-param-desc {
  display: -webkit-box;
  margin-top: 5px;
  overflow: hidden;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.quick-param-control {
  width: 100%;
}

.no-params.compact {
  padding: 18px 12px;
  margin-top: 0;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #d8dee8;
  border-radius: 8px;
}

.json-editor {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.drawer-actions {
  display: flex;
  position: sticky;
  bottom: 0;
  z-index: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 16px;
  margin-top: auto;
  background: #fff;
  border-top: 1px solid #edf0f3;
}

.call-error {
  flex: 1;
  min-width: 0;
  margin-right: auto;
  text-align: left;
}

.call-result-empty {
  display: flex;
  min-height: 220px;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
  text-align: center;
}

.result-block {
  margin-bottom: 12px;
}

.result-label {
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
}

.code-block {
  max-height: 520px;
  padding: 12px;
  overflow: auto;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
  background: #f8fafc;
  border-radius: 8px;
}

.schema-code {
  max-height: calc(100vh - 300px);
  min-height: 360px;
}

.result-code {
  max-height: 320px;
}

.code-block.compact {
  max-height: 180px;
  margin: 8px 0;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-item {
  padding: 12px;
  border: 1px solid #edf0f3;
  border-radius: 8px;
}

.log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.log-meta {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 768px) {
  :global(.reference-drawer .ant-drawer-content-wrapper) {
    width: 100vw !important;
  }

  :global(.call-debug-drawer .ant-drawer-content-wrapper) {
    width: 100vw !important;
  }

  .page-header,
  .card-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-actions {
    justify-content: flex-start;
  }

  .header-controls,
  .group-filter,
  .search-input {
    width: 100%;
  }

  .tool-grid,
  .call-workbench {
    grid-template-columns: 1fr;
  }

  .call-editor-panel {
    min-height: auto;
  }

  .call-result-panel {
    position: static;
    max-height: none;
  }

  .drawer-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .call-error {
    width: 100%;
  }

  .quick-param-list,
  .schema-code {
    max-height: none;
  }

  .quick-param-row {
    grid-template-columns: 1fr;
  }
}
</style>
