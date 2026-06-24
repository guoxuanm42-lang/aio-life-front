<script setup lang="ts">
import type {
  ProblemCategory,
  ProblemCategoryItem,
} from '#/api/core/problem-category';
import type { ProblemNote, ProblemNoteStatus } from '#/api/core/problem-note';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Collapse,
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';
import 'highlight.js/styles/github.css';
import { marked } from 'marked';

import {
  deleteProblemCategory,
  getProblemCategoryList,
  saveProblemCategory,
  updateProblemCategory,
} from '#/api/core/problem-category';
import {
  deleteProblemNote,
  getProblemNoteDetail,
  queryProblemNotes,
  saveProblemNote,
  updateProblemNote,
} from '#/api/core/problem-note';
import { copyToClipboard } from '#/utils/clipboard';

hljs.registerLanguage('java', java);

type CategoryKey = 'all' | 'uncategorized' | string;
type ViewMode = 'category' | 'list';

const TEXT_FONT_SIZES = [14, 16, 18, 20, 22];
const CODE_FONT_SIZES = [13, 14, 16, 18, 20];
const TEXT_FONT_KEY = 'problem-note-text-font-size';
const CODE_FONT_KEY = 'problem-note-code-font-size';

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已解决', value: 'solved' },
  { label: '复习中', value: 'reviewing' },
  { label: '已归档', value: 'archived' },
];

const difficultyOptions = [
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' },
];

const viewMode = ref<ViewMode>('category');
const selectedCategoryId = ref<CategoryKey>('all');
const categoryLoading = ref(false);
const categories = ref<ProblemCategoryItem[]>([]);
const totalCount = ref(0);
const uncategorizedCount = ref(0);
const categoryModalOpen = ref(false);
const categorySaving = ref(false);
const categoryModalTitle = ref('新增分类');

const notes = ref<ProblemNote[]>([]);
const activeNote = ref<ProblemNote | null>(null);
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const modalTitle = ref('新增题目');
const textFontSize = ref(readFontSize(TEXT_FONT_KEY, 18, TEXT_FONT_SIZES));
const codeFontSize = ref(readFontSize(CODE_FONT_KEY, 16, CODE_FONT_SIZES));
const isCodeFullscreen = ref(false);
const activeCollapseKeys = ref<string[]>([
  'problem',
  'pseudoCode',
  'solutionCode',
]);

const queryState = reactive({
  difficulty: '',
  keyword: '',
  page: 1,
  pageSize: 100,
  status: '' as '' | ProblemNoteStatus,
  tags: '',
});

const categoryForm = reactive<ProblemCategory>({
  id: undefined,
  name: '',
  sortOrder: 0,
});

const formState = reactive<ProblemNote>({
  categoryId: undefined,
  difficulty: undefined,
  ideaNote: '',
  problemContent: '',
  pseudoCode: '',
  solutionCode: '',
  status: 'draft',
  tags: '',
  title: '',
});

const categoryOptions = computed(() => [
  { label: '未分类', value: '' },
  ...categories.value.map((item) => ({
    label: item.name,
    value: String(item.id),
  })),
]);

const currentCategoryName = computed(() => {
  if (selectedCategoryId.value === 'all') {
    return '全部题目';
  }
  if (selectedCategoryId.value === 'uncategorized') {
    return '未分类';
  }
  return (
    categories.value.find((item) => String(item.id) === selectedCategoryId.value)
      ?.name || '题目'
  );
});

const currentCategoryCount = computed(() => {
  if (selectedCategoryId.value === 'all') {
    return totalCount.value;
  }
  if (selectedCategoryId.value === 'uncategorized') {
    return uncategorizedCount.value;
  }
  return (
    categories.value.find((item) => String(item.id) === selectedCategoryId.value)
      ?.problemCount || 0
  );
});

const highlightedCode = computed(() => {
  const code = activeNote.value?.solutionCode || '';
  return hljs.highlight(code, {
    ignoreIllegals: true,
    language: 'java',
  }).value;
});

const renderedProblemContent = computed(() =>
  renderMarkdown(activeNote.value?.problemContent || ''),
);

const renderedIdeaNote = computed(() =>
  renderMarkdown(activeNote.value?.ideaNote || ''),
);

const hasPseudoCode = computed(() =>
  Boolean(activeNote.value?.pseudoCode?.trim()),
);

const hasSolutionCode = computed(() =>
  Boolean(activeNote.value?.solutionCode?.trim()),
);

const hasIdeaNote = computed(() => Boolean(activeNote.value?.ideaNote?.trim()));

function renderMarkdown(content: string) {
  const html = marked.parse(content, {
    async: false,
    breaks: true,
    gfm: true,
  });
  return DOMPurify.sanitize(html);
}

function readFontSize(key: string, fallback: number, allowed: number[]) {
  const saved = Number(window.localStorage.getItem(key));
  return allowed.includes(saved) ? saved : fallback;
}

function updateFontSize(
  target: 'code' | 'text',
  direction: 'decrease' | 'increase',
) {
  const sizes = target === 'text' ? TEXT_FONT_SIZES : CODE_FONT_SIZES;
  const current = target === 'text' ? textFontSize.value : codeFontSize.value;
  const index = sizes.indexOf(current);
  const nextIndex =
    direction === 'increase'
      ? Math.min(index + 1, sizes.length - 1)
      : Math.max(index - 1, 0);
  const next = sizes[nextIndex] ?? current;
  if (target === 'text') {
    textFontSize.value = next;
    window.localStorage.setItem(TEXT_FONT_KEY, String(next));
  } else {
    codeFontSize.value = next;
    window.localStorage.setItem(CODE_FONT_KEY, String(next));
  }
}

function getStatusLabel(status?: string) {
  return statusOptions.find((item) => item.value === status)?.label || '草稿';
}

function getStatusColor(status?: string) {
  const colorMap: Record<string, string> = {
    archived: 'default',
    draft: 'blue',
    reviewing: 'orange',
    solved: 'green',
  };
  return colorMap[status || 'draft'] || 'blue';
}

function getDifficultyLabel(difficulty?: string) {
  return (
    difficultyOptions.find((item) => item.value === difficulty)?.label ||
    difficulty ||
    '未设置'
  );
}

function getDifficultyColor(difficulty?: string) {
  const colorMap: Record<string, string> = {
    easy: 'green',
    hard: 'red',
    medium: 'orange',
  };
  return colorMap[difficulty || ''] || 'default';
}

function splitTags(tags?: string) {
  return (tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resetCollapseKeys(note?: ProblemNote | null) {
  const keys = ['problem'];
  if (note?.pseudoCode?.trim()) {
    keys.push('pseudoCode');
  }
  if (note?.solutionCode?.trim()) {
    keys.push('solutionCode');
  }
  activeCollapseKeys.value = keys;
}

function resetForm() {
  formState.id = undefined;
  formState.title = '';
  formState.problemContent = '';
  formState.pseudoCode = '';
  formState.solutionCode = '';
  formState.ideaNote = '';
  formState.difficulty = undefined;
  formState.tags = '';
  formState.status = 'draft';
  formState.categoryId =
    selectedCategoryId.value === 'all' ||
    selectedCategoryId.value === 'uncategorized'
      ? undefined
      : selectedCategoryId.value;
}

function fillForm(note: ProblemNote) {
  formState.id = note.id;
  formState.title = note.title;
  formState.problemContent = note.problemContent;
  formState.pseudoCode = note.pseudoCode || '';
  formState.solutionCode = note.solutionCode || '';
  formState.ideaNote = note.ideaNote || '';
  formState.difficulty = note.difficulty;
  formState.tags = note.tags || '';
  formState.status = note.status || 'draft';
  formState.categoryId = note.categoryId ? String(note.categoryId) : undefined;
}

async function fetchCategories() {
  categoryLoading.value = true;
  try {
    const res = await getProblemCategoryList();
    categories.value = res.categories || [];
    totalCount.value = Number(res.totalCount || 0);
    uncategorizedCount.value = Number(res.uncategorizedCount || 0);
  } finally {
    categoryLoading.value = false;
  }
}

function buildQueryParams() {
  const params = { ...queryState };
  if (selectedCategoryId.value === 'uncategorized') {
    return { ...params, uncategorized: true };
  }
  if (selectedCategoryId.value !== 'all') {
    return { ...params, categoryId: selectedCategoryId.value };
  }
  return params;
}

async function fetchNotes() {
  loading.value = true;
  try {
    const res = await queryProblemNotes(buildQueryParams());
    notes.value = res.items || [];
    if (!notes.value.some((item) => item.id === activeNote.value?.id)) {
      activeNote.value = notes.value[0] || null;
      if (activeNote.value) {
        await selectNote(activeNote.value);
      }
    }
  } finally {
    loading.value = false;
  }
}

async function enterCategory(categoryId: CategoryKey) {
  selectedCategoryId.value = categoryId;
  viewMode.value = 'list';
  activeNote.value = null;
  await fetchNotes();
}

function backToCategories() {
  viewMode.value = 'category';
  activeNote.value = null;
  notes.value = [];
  fetchCategories();
}

async function selectNote(note: ProblemNote) {
  if (!note.id) {
    activeNote.value = note;
    resetCollapseKeys(note);
    return;
  }
  detailLoading.value = true;
  try {
    activeNote.value = await getProblemNoteDetail(note.id);
    resetCollapseKeys(activeNote.value);
  } finally {
    detailLoading.value = false;
  }
}

function handleAdd() {
  resetForm();
  modalTitle.value = '新增题目';
  modalOpen.value = true;
}

function handleEdit(note?: ProblemNote | null) {
  const target = note || activeNote.value;
  if (!target) {
    return;
  }
  fillForm(target);
  modalTitle.value = '编辑题目';
  modalOpen.value = true;
}

async function handleDelete(id?: string) {
  if (!id) {
    return;
  }
  await deleteProblemNote(id);
  message.success('删除成功');
  if (activeNote.value?.id === id) {
    activeNote.value = null;
  }
  await fetchNotes();
  await fetchCategories();
}

async function handleSave() {
  if (!formState.title.trim()) {
    message.warning('请输入题目标题');
    return;
  }
  if (!formState.problemContent.trim()) {
    message.warning('请输入题目内容');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...formState,
      categoryId: formState.categoryId || undefined,
    };
    const saved = payload.id
      ? await updateProblemNote(payload)
      : await saveProblemNote(payload);
    activeNote.value = saved;
    resetCollapseKeys(saved);
    modalOpen.value = false;
    message.success('保存成功');
    await fetchNotes();
    await fetchCategories();
  } finally {
    saving.value = false;
  }
}

function openCategoryModal(category?: ProblemCategoryItem) {
  categoryForm.id = category?.id ? String(category.id) : undefined;
  categoryForm.name = category?.name || '';
  categoryForm.sortOrder = category?.sortOrder || 0;
  categoryModalTitle.value = category ? '编辑分类' : '新增分类';
  categoryModalOpen.value = true;
}

async function handleSaveCategory() {
  if (!categoryForm.name.trim()) {
    message.warning('请输入分类名称');
    return;
  }
  categorySaving.value = true;
  try {
    const payload = { ...categoryForm, name: categoryForm.name.trim() };
    if (payload.id) {
      await updateProblemCategory(payload);
    } else {
      await saveProblemCategory(payload);
    }
    categoryModalOpen.value = false;
    message.success('分类已保存');
    await fetchCategories();
  } finally {
    categorySaving.value = false;
  }
}

async function handleDeleteCategory(id?: string) {
  if (!id) {
    return;
  }
  await deleteProblemCategory(id);
  message.success('分类已删除，题目已移入未分类');
  if (selectedCategoryId.value === String(id)) {
    backToCategories();
  }
  await fetchCategories();
}

async function copyText(content: string | undefined, successText: string) {
  if (!content) {
    message.warning('没有可复制的内容');
    return;
  }
  try {
    await copyToClipboard(content);
    message.success(successText);
  } catch {
    message.error('复制失败，请手动复制');
  }
}

function toggleCodeFullscreen() {
  isCodeFullscreen.value = !isCodeFullscreen.value;
}

function exitCodeFullscreen() {
  isCodeFullscreen.value = false;
}

function handleCodeFullscreenKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isCodeFullscreen.value) {
    exitCodeFullscreen();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleCodeFullscreenKeydown);
  fetchCategories();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleCodeFullscreenKeydown);
});
</script>

<template>
  <div class="problem-note-page">
    <template v-if="viewMode === 'category'">
      <div class="category-header">
        <div>
          <h1>题目分类</h1>
          <p>先选择分类，再进入题目列表和详情。</p>
        </div>
        <Button type="primary" @click="openCategoryModal()">
          <template #icon><PlusOutlined /></template>
          新增分类
        </Button>
      </div>

      <Spin :spinning="categoryLoading">
        <div class="category-grid">
          <button class="category-card virtual" type="button" @click="enterCategory('all')">
            <span class="category-name">全部题目</span>
            <span class="category-count">{{ totalCount }} 题</span>
          </button>
          <button
            class="category-card virtual"
            type="button"
            @click="enterCategory('uncategorized')"
          >
            <span class="category-name">未分类</span>
            <span class="category-count">{{ uncategorizedCount }} 题</span>
          </button>
          <div v-for="item in categories" :key="item.id" class="category-card user">
            <button class="category-main" type="button" @click="enterCategory(String(item.id))">
              <span class="category-name">{{ item.name }}</span>
              <span class="category-count">{{ item.problemCount }} 题</span>
            </button>
            <div class="category-actions">
              <Button type="text" size="small" @click="openCategoryModal(item)">
                <template #icon><EditOutlined /></template>
              </Button>
              <Popconfirm
                title="删除后该分类下题目会进入未分类，确定删除？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="handleDeleteCategory(String(item.id))"
              >
                <Button type="text" size="small" danger>
                  <template #icon><DeleteOutlined /></template>
                </Button>
              </Popconfirm>
            </div>
          </div>
        </div>
      </Spin>
    </template>

    <template v-else>
      <div class="list-header">
        <div class="list-heading">
        <Button @click="backToCategories">
          <template #icon><ArrowLeftOutlined /></template>
          返回分类
        </Button>
        <div class="list-title">
          <h1>{{ currentCategoryName }}</h1>
          <span>{{ currentCategoryCount }} 题</span>
        </div>
        </div>
        <Button type="primary" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增题目
        </Button>
      </div>

      <div class="toolbar">
        <Input.Search
          v-model:value="queryState.keyword"
          allow-clear
          placeholder="搜索标题、题目或思路"
          class="toolbar-search"
          @search="fetchNotes"
        />
        <Select
          v-model:value="queryState.difficulty"
          allow-clear
          placeholder="难度"
          class="toolbar-select"
          :options="difficultyOptions"
          @change="fetchNotes"
        />
        <Select
          v-model:value="queryState.status"
          allow-clear
          placeholder="状态"
          class="toolbar-select"
          :options="statusOptions"
          @change="fetchNotes"
        />
        <Input
          v-model:value="queryState.tags"
          allow-clear
          placeholder="标签"
          class="toolbar-tags"
          @press-enter="fetchNotes"
        />
      </div>

      <div class="content-layout">
        <aside class="note-list-panel">
          <Spin :spinning="loading">
            <div v-if="notes.length > 0" class="note-list">
              <button
                v-for="item in notes"
                :key="item.id"
                class="note-card"
                :class="{ active: item.id === activeNote?.id }"
                type="button"
                @click="selectNote(item)"
              >
                <div class="note-card-head">
                  <h3>{{ item.title }}</h3>
                  <Tag :color="getStatusColor(item.status)">
                    {{ getStatusLabel(item.status) }}
                  </Tag>
                </div>
                <p class="note-summary">
                  {{ item.ideaNote || item.problemContent }}
                </p>
                <div class="note-meta">
                  <Tag :color="getDifficultyColor(item.difficulty)">
                    {{ getDifficultyLabel(item.difficulty) }}
                  </Tag>
                  <span>{{ item.updateTime || item.createTime }}</span>
                </div>
                <div v-if="splitTags(item.tags).length > 0" class="tag-row">
                  <Tag v-for="tag in splitTags(item.tags)" :key="tag">
                    {{ tag }}
                  </Tag>
                </div>
              </button>
            </div>
            <Empty v-else description="暂无题目" class="empty-list" />
          </Spin>
        </aside>

        <main class="detail-panel">
          <Spin :spinning="detailLoading">
            <template v-if="activeNote">
              <div class="detail-header">
                <div>
                  <h1>{{ activeNote.title }}</h1>
                  <Space wrap>
                    <Tag :color="getDifficultyColor(activeNote.difficulty)">
                      {{ getDifficultyLabel(activeNote.difficulty) }}
                    </Tag>
                    <Tag :color="getStatusColor(activeNote.status)">
                      {{ getStatusLabel(activeNote.status) }}
                    </Tag>
                    <Tag v-for="tag in splitTags(activeNote.tags)" :key="tag">
                      {{ tag }}
                    </Tag>
                  </Space>
                </div>
                <Space>
                  <Button @click="handleEdit()">
                    <template #icon><EditOutlined /></template>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除这道题目吗？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="handleDelete(activeNote.id)"
                  >
                    <Button danger>
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              <Collapse
                v-model:active-key="activeCollapseKeys"
                class="detail-collapse"
                ghost
              >
                <Collapse.Panel key="problem">
                  <template #header>
                    <div class="section-head collapse-section-head">
                      <h2>题目</h2>
                      <Space @click.stop>
                        <Button
                          size="small"
                          @click="updateFontSize('text', 'decrease')"
                        >
                          A-
                        </Button>
                        <span class="font-size-label">{{ textFontSize }}px</span>
                        <Button
                          size="small"
                          @click="updateFontSize('text', 'increase')"
                        >
                          A+
                        </Button>
                        <Button
                          size="small"
                          @click="copyText(activeNote.problemContent, '题目已复制')"
                        >
                          <template #icon><CopyOutlined /></template>
                          复制题目
                        </Button>
                      </Space>
                    </div>
                  </template>
                  <div
                    class="markdown-content"
                    :style="{ fontSize: `${textFontSize}px` }"
                    v-html="renderedProblemContent"
                  ></div>
                </Collapse.Panel>

                <Collapse.Panel v-if="hasPseudoCode" key="pseudoCode">
                  <template #header>
                    <div class="section-head collapse-section-head">
                      <h2>伪代码</h2>
                      <Space @click.stop>
                        <Button
                          size="small"
                          @click="copyText(activeNote.pseudoCode, '伪代码已复制')"
                        >
                          <template #icon><CopyOutlined /></template>
                          复制伪代码
                        </Button>
                      </Space>
                    </div>
                  </template>
                  <pre class="pseudo-code">{{ activeNote.pseudoCode }}</pre>
                </Collapse.Panel>

                <Collapse.Panel v-if="hasSolutionCode" key="solutionCode">
                  <template #header>
                    <div class="section-head collapse-section-head">
                      <h2>Java 代码</h2>
                      <Space @click.stop>
                        <Button
                          size="small"
                          @click="updateFontSize('code', 'decrease')"
                        >
                          A-
                        </Button>
                        <span class="font-size-label">{{ codeFontSize }}px</span>
                        <Button
                          size="small"
                          @click="updateFontSize('code', 'increase')"
                        >
                          A+
                        </Button>
                        <Button size="small" @click="toggleCodeFullscreen">
                          <template #icon>
                            <FullscreenExitOutlined v-if="isCodeFullscreen" />
                            <FullscreenOutlined v-else />
                          </template>
                          {{ isCodeFullscreen ? '退出全屏' : '全屏' }}
                        </Button>
                        <Button
                          size="small"
                          @click="copyText(activeNote.solutionCode, '代码已复制')"
                        >
                          <template #icon><CopyOutlined /></template>
                          复制代码
                        </Button>
                      </Space>
                    </div>
                  </template>
                  <section
                    class="code-section"
                    :class="{ 'code-fullscreen-section': isCodeFullscreen }"
                  >
                    <div class="fullscreen-code-toolbar">
                      <h2>Java 代码</h2>
                      <Space wrap>
                        <Button
                          size="small"
                          @click="updateFontSize('code', 'decrease')"
                        >
                          A-
                        </Button>
                        <span class="font-size-label">{{ codeFontSize }}px</span>
                        <Button
                          size="small"
                          @click="updateFontSize('code', 'increase')"
                        >
                          A+
                        </Button>
                        <Button size="small" @click="toggleCodeFullscreen">
                          <template #icon><FullscreenExitOutlined /></template>
                          退出全屏
                        </Button>
                        <Button
                          size="small"
                          @click="copyText(activeNote.solutionCode, '代码已复制')"
                        >
                          <template #icon><CopyOutlined /></template>
                          复制代码
                        </Button>
                      </Space>
                    </div>
                    <div class="code-card">
                      <div class="code-title">
                        <span class="code-language">&lt;/&gt; Java</span>
                        <Button
                          type="text"
                          shape="circle"
                          @click="copyText(activeNote.solutionCode, '代码已复制')"
                        >
                          <template #icon><CopyOutlined /></template>
                        </Button>
                      </div>
                      <pre
                        class="java-code"
                        :style="{ fontSize: `${codeFontSize}px` }"
                      ><code class="hljs language-java" v-html="highlightedCode"></code></pre>
                    </div>
                  </section>
                </Collapse.Panel>

                <Collapse.Panel v-if="hasIdeaNote" key="ideaNote">
                  <template #header>
                    <div class="section-head collapse-section-head">
                      <h2>思路</h2>
                    </div>
                  </template>
                  <div
                    class="markdown-content"
                    :style="{ fontSize: `${textFontSize}px` }"
                    v-html="renderedIdeaNote"
                  ></div>
                </Collapse.Panel>
              </Collapse>
            </template>
            <Empty v-else description="请选择或新增题目" class="empty-detail" />
          </Spin>
        </main>
      </div>
    </template>

    <Modal
      v-model:open="categoryModalOpen"
      :title="categoryModalTitle"
      :confirm-loading="categorySaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSaveCategory"
    >
      <Space direction="vertical" class="category-form">
        <Input v-model:value="categoryForm.name" placeholder="分类名称，例如：字符串" />
        <InputNumber
          v-model:value="categoryForm.sortOrder"
          class="sort-input"
          placeholder="排序值"
        />
      </Space>
    </Modal>

    <Modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :confirm-loading="saving"
      :mask-closable="false"
      width="900px"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSave"
    >
      <div class="form-grid">
        <Input v-model:value="formState.title" placeholder="题目标题" />
        <Select
          v-model:value="formState.categoryId"
          allow-clear
          placeholder="所属分类"
          :options="categoryOptions"
        />
        <Select
          v-model:value="formState.difficulty"
          allow-clear
          placeholder="难度"
          :options="difficultyOptions"
        />
        <Select
          v-model:value="formState.status"
          placeholder="状态"
          :options="statusOptions"
        />
      </div>
      <Input.TextArea
        v-model:value="formState.problemContent"
        class="form-textarea"
        placeholder="粘贴题目内容，支持 Markdown"
        :rows="7"
      />
      <Input.TextArea
        v-model:value="formState.pseudoCode"
        class="form-textarea code-input"
        placeholder="粘贴或编写伪代码"
        :rows="7"
      />
      <Input.TextArea
        v-model:value="formState.solutionCode"
        class="form-textarea code-input"
        placeholder="粘贴 Java 解法代码"
        :rows="10"
      />
      <Input.TextArea
        v-model:value="formState.ideaNote"
        class="form-textarea"
        placeholder="记录解题思路，支持 Markdown"
        :rows="5"
      />
    </Modal>

  </div>
</template>

<style scoped>
.problem-note-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  padding: 20px;
}

.category-header,
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.list-heading {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14px;
}

.category-header h1 {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
}

.list-title h1 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
}

.category-header p {
  margin: 6px 0 0;
  color: #64748b;
}

.list-title span {
  margin: 2px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.2;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  overflow: auto;
}

.category-card {
  position: relative;
  display: flex;
  min-height: 128px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 5%);
  color: inherit;
  text-align: left;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.category-card:hover {
  border-color: #91caff;
  box-shadow: 0 12px 30px rgb(15 23 42 / 9%);
  transform: translateY(-1px);
}

.category-card.virtual {
  cursor: pointer;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
}

.category-card.user {
  flex-direction: column;
  justify-content: space-between;
}

.category-main {
  display: flex;
  width: 100%;
  flex: 1;
  cursor: pointer;
  border: 0;
  background: transparent;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  text-align: left;
}

.category-name {
  color: #111827;
  font-size: 20px;
  font-weight: 800;
  line-height: 1.35;
}

.category-count {
  color: #64748b;
  font-size: 14px;
}

.category-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(320px, 520px) repeat(3, minmax(120px, 160px));
  gap: 12px;
  align-items: center;
  justify-content: start;
}

.toolbar-search {
  min-width: 0;
  width: 100%;
}

.toolbar-select,
.toolbar-tags {
  min-width: 0;
  width: 100%;
}

.content-layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  gap: 16px;
}

.note-list-panel,
.detail-panel {
  min-height: 0;
  overflow: auto;
}

.note-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.note-card {
  width: 100%;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
  text-align: left;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    transform 0.2s;
}

.note-card:hover,
.note-card.active {
  border-color: #91caff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.note-card-head,
.detail-header,
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.note-card-head h3 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.note-summary {
  display: -webkit-box;
  margin: 10px 0;
  overflow: hidden;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.note-meta,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.note-meta span {
  color: #94a3b8;
  font-size: 12px;
}

.tag-row {
  margin-top: 8px;
}

.detail-panel {
  border-radius: 8px;
  background: #fff;
  padding: 28px;
}

.detail-header {
  margin-bottom: 24px;
}

.detail-header h1 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
}

.read-section {
  margin-top: 24px;
}

.detail-collapse {
  margin-top: 24px;
}

.detail-collapse :deep(.ant-collapse-header) {
  align-items: center;
  padding: 14px 0 !important;
}

.detail-collapse :deep(.ant-collapse-content-box) {
  padding: 8px 0 18px !important;
}

.collapse-section-head {
  width: 100%;
  margin-bottom: 0;
}

.code-fullscreen-section {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  overflow: hidden;
  margin: 0;
  background: #fff;
  flex-direction: column;
  padding: 24px;
}

.fullscreen-code-toolbar {
  display: none;
}

.code-fullscreen-section .fullscreen-code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 16px;
}

.fullscreen-code-toolbar h2 {
  margin: 0;
  color: #111827;
  font-size: 22px;
  font-weight: 800;
}

.code-fullscreen-section .code-card {
  display: flex;
  min-height: 0;
  flex: 1;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgb(15 23 42 / 12%);
  flex-direction: column;
}

.code-fullscreen-section .code-title {
  flex-shrink: 0;
}

.code-fullscreen-section .java-code {
  min-height: 0;
  flex: 1;
}

.code-fullscreen-section :deep(.ant-space) {
  flex-wrap: wrap;
}

.section-head {
  align-items: center;
  margin-bottom: 12px;
}

.section-head h2 {
  margin: 0;
  color: #111827;
  font-size: 22px;
  font-weight: 800;
}

.font-size-label {
  min-width: 38px;
  color: #64748b;
  text-align: center;
}

.markdown-content {
  word-break: break-word;
  color: #1e293b;
  line-height: 1.85;
}

.markdown-content :deep(p) {
  margin: 0 0 12px;
}

.markdown-content :deep(h1) {
  margin: 18px 0 12px;
  color: #0f172a;
  font-size: 1.7em;
  font-weight: 800;
  line-height: 1.35;
}

.markdown-content :deep(h2) {
  margin: 16px 0 10px;
  color: #0f172a;
  font-size: 1.35em;
  font-weight: 800;
  line-height: 1.4;
}

.markdown-content :deep(h3) {
  margin: 14px 0 8px;
  color: #0f172a;
  font-size: 1.12em;
  font-weight: 700;
  line-height: 1.45;
}

.markdown-content :deep(code) {
  border-radius: 4px;
  background: #f1f5f9;
  color: #be123c;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.9em;
  padding: 2px 5px;
}

.markdown-content :deep(pre) {
  overflow-x: auto;
  border-radius: 8px;
  background: #f8fafc;
  padding: 14px 16px;
}

.markdown-content :deep(pre code) {
  display: block;
  background: transparent;
  color: #334155;
  padding: 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0 0 12px 24px;
  padding: 0;
}

.markdown-content :deep(li) {
  margin: 5px 0;
}

.markdown-content :deep(blockquote) {
  margin: 0 0 12px;
  border-left: 4px solid #bfdbfe;
  background: #eff6ff;
  color: #475569;
  padding: 10px 14px;
}

.markdown-content :deep(table) {
  width: 100%;
  margin: 12px 0;
  border-collapse: collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 8px 10px;
}

.markdown-content :deep(th) {
  background: #f8fafc;
  font-weight: 700;
}

.pseudo-code {
  margin: 0;
  overflow: auto;
  border-radius: 12px;
  background: #f7f7f7;
  color: #374151;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 16px;
  line-height: 1.9;
  padding: 24px 32px;
  white-space: pre-wrap;
  word-break: break-word;
}

.code-card {
  overflow: hidden;
  border-radius: 24px;
  background: #f5f5f5;
}

.code-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px 0;
}

.code-language {
  color: #111827;
  font-size: 16px;
  font-weight: 800;
}

.java-code {
  margin: 0;
  overflow: auto;
  padding: 24px 32px 34px;
  line-height: 1.9;
}

.java-code code {
  background: transparent;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.empty-list,
.empty-detail {
  margin-top: 80px;
}

.category-form {
  width: 100%;
}

.sort-input {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px 140px 140px;
  gap: 12px;
  margin-bottom: 12px;
}

.form-textarea {
  margin-top: 12px;
}

.code-input :deep(textarea) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

@media (max-width: 1024px) {
  .content-layout {
    grid-template-columns: 1fr;
  }

  .note-list-panel {
    max-height: 320px;
  }

  .form-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .problem-note-page {
    padding: 12px;
  }

  .category-header,
  .list-header,
  .detail-header,
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .list-header {
    gap: 10px;
  }

  .list-heading {
    width: 100%;
    flex-wrap: wrap;
  }

  .toolbar {
    grid-template-columns: 1fr;
  }

  .detail-panel {
    padding: 18px;
  }

  .code-fullscreen-section {
    padding: 12px;
  }

  .code-fullscreen-section .section-head {
    gap: 10px;
  }

  .code-fullscreen-section .fullscreen-code-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .code-fullscreen-section .code-title {
    padding: 12px 16px 0;
  }

  .code-fullscreen-section .java-code {
    padding: 16px;
  }

  .pseudo-code {
    padding: 16px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
