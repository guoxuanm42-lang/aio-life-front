<script setup lang="ts">
import type { Article, ArticleStatus } from '#/api/core/article';
import type {
  ArticleCategory,
  ArticleCategoryItem,
} from '#/api/core/article-category';

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';

import {
  ArrowLeftOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  PlusOutlined,
  UpOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
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
import { marked } from 'marked';

import {
  deleteArticle,
  getArticleDetail,
  queryArticles,
  saveArticle,
  updateArticle,
} from '#/api/core/article';
import {
  deleteArticleCategory,
  getArticleCategoryList,
  saveArticleCategory,
  updateArticleCategory,
} from '#/api/core/article-category';
import { copyToClipboard } from '#/utils/clipboard';

type CategoryKey = 'all' | 'uncategorized' | string;
type ViewMode = 'category' | 'list';

const READER_FONT_SIZES = [14, 16, 18, 20, 22];
const READER_WIDTHS = [720, 860, 1024, 1200];
const READER_FONT_KEY = 'article-reader-font-size';
const READER_WIDTH_KEY = 'article-reader-width';

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已完成', value: 'published' },
  { label: '已归档', value: 'archived' },
];

const viewMode = ref<ViewMode>('category');
const selectedCategoryId = ref<CategoryKey>('all');

const categoryLoading = ref(false);
const categories = ref<ArticleCategoryItem[]>([]);
const totalCount = ref(0);
const uncategorizedCount = ref(0);
const categoryModalOpen = ref(false);
const categorySaving = ref(false);
const categoryModalTitle = ref('新增分类');

const articles = ref<Article[]>([]);
const activeArticle = ref<Article | null>(null);
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const articleModalOpen = ref(false);
const articleModalTitle = ref('新增文章');
const readerFontSize = ref(
  readReaderPreference(READER_FONT_KEY, 16, READER_FONT_SIZES),
);
const readerWidth = ref(readReaderPreference(READER_WIDTH_KEY, 860, READER_WIDTHS));
const isReaderFullscreen = ref(false);
const readerSettingsOpen = ref(false);

const queryState = reactive({
  keyword: '',
  page: 1,
  pageSize: 100,
  status: '' as '' | ArticleStatus,
  tags: '',
});

const categoryForm = reactive<ArticleCategory>({
  id: undefined,
  name: '',
  sortOrder: 0,
});

const formState = reactive<Article>({
  categoryId: undefined,
  markdownContent: '',
  status: 'draft',
  summary: '',
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
    return '全部文章';
  }
  if (selectedCategoryId.value === 'uncategorized') {
    return '未分类';
  }
  return (
    categories.value.find((item) => String(item.id) === selectedCategoryId.value)
      ?.name || '文章'
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
      ?.articleCount || 0
  );
});

const renderedMarkdown = computed(() =>
  renderMarkdown(activeArticle.value?.markdownContent || ''),
);

const editorPreviewMarkdown = computed(() =>
  renderMarkdown(formState.markdownContent || ''),
);

const readingBodyStyle = computed(() => ({
  fontSize: `${readerFontSize.value}px`,
  maxWidth: `${readerWidth.value}px`,
}));

function renderMarkdown(content: string) {
  const html = marked.parse(content, {
    async: false,
    breaks: true,
    gfm: true,
  });
  return DOMPurify.sanitize(html);
}

function readReaderPreference(key: string, fallback: number, allowed: number[]) {
  const saved = Number(window.localStorage.getItem(key));
  return allowed.includes(saved) ? saved : fallback;
}

function updateReaderFontSize(direction: 'decrease' | 'increase') {
  const currentIndex = READER_FONT_SIZES.indexOf(readerFontSize.value);
  const nextIndex =
    direction === 'increase'
      ? Math.min(currentIndex + 1, READER_FONT_SIZES.length - 1)
      : Math.max(currentIndex - 1, 0);
  const next = READER_FONT_SIZES[nextIndex] ?? readerFontSize.value;
  readerFontSize.value = next;
  window.localStorage.setItem(READER_FONT_KEY, String(next));
}

function updateReaderWidth(direction: 'decrease' | 'increase') {
  const currentIndex = READER_WIDTHS.indexOf(readerWidth.value);
  const nextIndex =
    direction === 'increase'
      ? Math.min(currentIndex + 1, READER_WIDTHS.length - 1)
      : Math.max(currentIndex - 1, 0);
  const next = READER_WIDTHS[nextIndex] ?? readerWidth.value;
  readerWidth.value = next;
  window.localStorage.setItem(READER_WIDTH_KEY, String(next));
}

async function copyMarkdown() {
  const content = activeArticle.value?.markdownContent;
  if (!content?.trim()) {
    message.warning('没有可复制的 Markdown 内容');
    return;
  }
  try {
    await copyToClipboard(content);
    message.success('Markdown 原文已复制');
  } catch {
    message.error('复制失败，请手动复制');
  }
}

function toggleReaderFullscreen() {
  isReaderFullscreen.value = !isReaderFullscreen.value;
}

function toggleReaderSettings() {
  readerSettingsOpen.value = !readerSettingsOpen.value;
}

function exitReaderFullscreen() {
  isReaderFullscreen.value = false;
}

function handleReaderKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isReaderFullscreen.value) {
    exitReaderFullscreen();
  }
}

function splitTags(tags?: string) {
  return (tags || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatusLabel(status?: string) {
  return statusOptions.find((item) => item.value === status)?.label || '草稿';
}

function getStatusColor(status?: string) {
  const colorMap: Record<string, string> = {
    archived: 'default',
    draft: 'blue',
    published: 'green',
  };
  return colorMap[status || 'draft'] || 'blue';
}

function getArticleSummary(article?: Article | null) {
  return article?.summary || article?.plainTextContent || article?.markdownContent || '';
}

async function fetchCategories() {
  categoryLoading.value = true;
  try {
    const res = await getArticleCategoryList();
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

async function fetchArticles() {
  loading.value = true;
  try {
    const res = await queryArticles(buildQueryParams());
    articles.value = res.items || [];
    if (!articles.value.some((item) => item.id === activeArticle.value?.id)) {
      activeArticle.value = articles.value[0] || null;
      if (activeArticle.value) {
        await selectArticle(activeArticle.value);
      }
    }
  } finally {
    loading.value = false;
  }
}

async function enterCategory(categoryId: CategoryKey) {
  selectedCategoryId.value = categoryId;
  viewMode.value = 'list';
  activeArticle.value = null;
  await fetchArticles();
}

async function backToCategories() {
  viewMode.value = 'category';
  activeArticle.value = null;
  articles.value = [];
  exitReaderFullscreen();
  await fetchCategories();
}

async function selectArticle(article: Article) {
  if (!article.id) {
    activeArticle.value = article;
    return;
  }
  detailLoading.value = true;
  try {
    activeArticle.value = await getArticleDetail(article.id);
  } finally {
    detailLoading.value = false;
  }
}

function resetArticleForm() {
  formState.id = undefined;
  formState.title = '';
  formState.summary = '';
  formState.markdownContent = '';
  formState.tags = '';
  formState.status = 'draft';
  formState.categoryId =
    selectedCategoryId.value === 'all' ||
    selectedCategoryId.value === 'uncategorized'
      ? undefined
      : selectedCategoryId.value;
}

function fillArticleForm(article: Article) {
  formState.id = article.id;
  formState.title = article.title;
  formState.summary = article.summary || '';
  formState.markdownContent = article.markdownContent || '';
  formState.tags = article.tags || '';
  formState.status = article.status || 'draft';
  formState.categoryId = article.categoryId ? String(article.categoryId) : undefined;
}

function handleAddArticle() {
  resetArticleForm();
  articleModalTitle.value = '新增文章';
  articleModalOpen.value = true;
}

function handleEditArticle(article?: Article | null) {
  const target = article || activeArticle.value;
  if (!target) {
    return;
  }
  fillArticleForm(target);
  articleModalTitle.value = '编辑文章';
  articleModalOpen.value = true;
}

async function handleSaveArticle() {
  if (!formState.title.trim()) {
    message.warning('请输入文章标题');
    return;
  }
  if (!formState.markdownContent?.trim()) {
    message.warning('请输入 Markdown 正文');
    return;
  }
  saving.value = true;
  try {
    const payload = {
      ...formState,
      categoryId: formState.categoryId || undefined,
      summary: formState.summary?.trim() || undefined,
      tags: formState.tags?.trim() || undefined,
      title: formState.title.trim(),
    };
    const saved = payload.id
      ? await updateArticle(payload)
      : await saveArticle(payload);
    activeArticle.value = saved;
    articleModalOpen.value = false;
    message.success('文章已保存');
    await fetchCategories();
    await fetchArticles();
    if (saved.id && articles.value.some((item) => item.id === saved.id)) {
      await selectArticle(saved);
    }
  } finally {
    saving.value = false;
  }
}

async function handleDeleteArticle(id?: string) {
  if (!id) {
    return;
  }
  await deleteArticle(id);
  message.success('文章已删除');
  if (activeArticle.value?.id === id) {
    activeArticle.value = null;
    exitReaderFullscreen();
  }
  await fetchCategories();
  await fetchArticles();
}

function openCategoryModal(category?: ArticleCategoryItem) {
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
      await updateArticleCategory(payload);
    } else {
      await saveArticleCategory(payload);
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
  await deleteArticleCategory(id);
  message.success('分类已删除，文章已转入未分类');
  if (selectedCategoryId.value === String(id)) {
    await backToCategories();
  } else {
    await fetchCategories();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleReaderKeydown);
  fetchCategories();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleReaderKeydown);
});
</script>

<template>
  <div class="article-page">
    <template v-if="viewMode === 'category'">
      <div class="page-header">
        <div>
          <h1>文章分类</h1>
          <p>选择分类进入文章列表，或维护自己的文章分类。</p>
        </div>
        <Button type="primary" @click="openCategoryModal()">
          <template #icon><PlusOutlined /></template>
          新增分类
        </Button>
      </div>

      <Spin :spinning="categoryLoading">
        <div class="category-grid">
          <button class="category-card virtual" type="button" @click="enterCategory('all')">
            <span class="category-name">全部文章</span>
            <span class="category-count">{{ totalCount }} 篇</span>
          </button>
          <button
            class="category-card virtual"
            type="button"
            @click="enterCategory('uncategorized')"
          >
            <span class="category-name">未分类</span>
            <span class="category-count">{{ uncategorizedCount }} 篇</span>
          </button>
          <div v-for="item in categories" :key="item.id" class="category-card user">
            <button class="category-main" type="button" @click="enterCategory(String(item.id))">
              <span class="category-name">{{ item.name }}</span>
              <span class="category-count">{{ item.articleCount }} 篇</span>
            </button>
            <div class="category-actions">
              <Button type="text" size="small" @click="openCategoryModal(item)">
                <template #icon><EditOutlined /></template>
              </Button>
              <Popconfirm
                title="删除后该分类下文章会转入未分类，确定删除？"
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
            <span>{{ currentCategoryCount }} 篇文章</span>
          </div>
        </div>
        <Button type="primary" @click="handleAddArticle">
          <template #icon><PlusOutlined /></template>
          新增文章
        </Button>
      </div>

      <div class="toolbar">
        <Input.Search
          v-model:value="queryState.keyword"
          allow-clear
          placeholder="搜索标题、摘要、正文或标签"
          class="toolbar-search"
          @search="fetchArticles"
        />
        <Select
          v-model:value="queryState.status"
          allow-clear
          placeholder="状态"
          class="toolbar-select"
          :options="statusOptions"
          @change="fetchArticles"
        />
        <Input
          v-model:value="queryState.tags"
          allow-clear
          placeholder="标签"
          class="toolbar-tags"
          @press-enter="fetchArticles"
        />
      </div>

      <div class="content-layout">
        <aside class="article-list-panel">
          <Spin :spinning="loading">
            <div v-if="articles.length > 0" class="article-list">
              <button
                v-for="item in articles"
                :key="item.id"
                class="article-card"
                :class="{ active: item.id === activeArticle?.id }"
                type="button"
                @click="selectArticle(item)"
              >
                <div class="article-card-head">
                  <h3>{{ item.title }}</h3>
                  <Tag :color="getStatusColor(item.status)">
                    {{ getStatusLabel(item.status) }}
                  </Tag>
                </div>
                <p class="article-summary">
                  {{ getArticleSummary(item) || '暂无摘要' }}
                </p>
                <div class="article-meta">
                  <span>{{ item.wordCount || 0 }} 字</span>
                  <span>{{ item.updateTime || item.createTime }}</span>
                </div>
                <div v-if="splitTags(item.tags).length > 0" class="tag-row">
                  <Tag v-for="tag in splitTags(item.tags)" :key="tag">
                    {{ tag }}
                  </Tag>
                </div>
              </button>
            </div>
            <Empty v-else description="暂无文章" class="empty-list" />
          </Spin>
        </aside>

        <main
          class="detail-panel"
          :class="{ 'article-reading-fullscreen': isReaderFullscreen }"
        >
          <Spin :spinning="detailLoading">
            <template v-if="activeArticle">
              <div class="detail-header">
                <div>
                  <h1>{{ activeArticle.title }}</h1>
                  <Space wrap>
                    <Tag :color="getStatusColor(activeArticle.status)">
                      {{ getStatusLabel(activeArticle.status) }}
                    </Tag>
                    <Tag v-for="tag in splitTags(activeArticle.tags)" :key="tag">
                      {{ tag }}
                    </Tag>
                    <span class="detail-meta">{{ activeArticle.wordCount || 0 }} 字</span>
                    <span class="detail-meta">
                      {{ activeArticle.updateTime || activeArticle.createTime }}
                    </span>
                  </Space>
                </div>
                <Space wrap>
                  <Button @click="handleEditArticle()">
                    <template #icon><EditOutlined /></template>
                    编辑
                  </Button>
                  <Popconfirm
                    title="确定删除这篇文章？"
                    ok-text="删除"
                    cancel-text="取消"
                    @confirm="handleDeleteArticle(activeArticle.id)"
                  >
                    <Button danger>
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              <div class="reading-toolbar">
                <Space wrap>
                  <Button size="small" @click="toggleReaderSettings">
                    <template #icon>
                      <UpOutlined v-if="readerSettingsOpen" />
                      <DownOutlined v-else />
                    </template>
                    阅读设置
                  </Button>
                  <Button size="small" @click="copyMarkdown">
                    <template #icon><CopyOutlined /></template>
                    复制 Markdown
                  </Button>
                  <Button size="small" @click="toggleReaderFullscreen">
                    <template #icon>
                      <FullscreenExitOutlined v-if="isReaderFullscreen" />
                      <FullscreenOutlined v-else />
                    </template>
                    {{ isReaderFullscreen ? '退出全屏' : '全屏阅读' }}
                  </Button>
                </Space>
                <div v-if="readerSettingsOpen" class="reading-settings">
                  <Space wrap>
                    <Button size="small" @click="updateReaderFontSize('decrease')">
                      A-
                    </Button>
                    <span class="toolbar-label">{{ readerFontSize }}px</span>
                    <Button size="small" @click="updateReaderFontSize('increase')">
                      A+
                    </Button>
                  </Space>
                  <Space wrap>
                    <Button size="small" @click="updateReaderWidth('decrease')">
                      窄一点
                    </Button>
                    <span class="toolbar-label">{{ readerWidth }}px</span>
                    <Button size="small" @click="updateReaderWidth('increase')">
                      宽一点
                    </Button>
                  </Space>
                </div>
              </div>

              <section
                class="reading-body"
                :style="readingBodyStyle"
                @dblclick="toggleReaderFullscreen"
              >
                <div
                  v-if="activeArticle.markdownContent"
                  class="markdown-content"
                  v-html="renderedMarkdown"
                ></div>
                <Empty v-else description="暂无正文" class="empty-detail" />
              </section>
            </template>
            <Empty v-else description="请选择或新增文章" class="empty-detail">
              <template #image>
                <FileTextOutlined class="empty-icon" />
              </template>
            </Empty>
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
        <Input v-model:value="categoryForm.name" placeholder="分类名称，例如：技术文章" />
        <InputNumber v-model:value="categoryForm.sortOrder" class="sort-input" placeholder="排序值" />
      </Space>
    </Modal>

    <Modal
      v-model:open="articleModalOpen"
      :title="articleModalTitle"
      :confirm-loading="saving"
      :mask-closable="false"
      width="1100px"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleSaveArticle"
    >
      <div class="form-grid">
        <Input v-model:value="formState.title" placeholder="文章标题" />
        <Select
          v-model:value="formState.categoryId"
          allow-clear
          placeholder="所属分类"
          :options="categoryOptions"
        />
        <Select
          v-model:value="formState.status"
          placeholder="状态"
          :options="statusOptions"
        />
      </div>
      <Input
        v-model:value="formState.tags"
        class="form-input"
        placeholder="标签，多个标签用英文逗号分隔"
      />
      <Input.TextArea
        v-model:value="formState.summary"
        class="form-textarea"
        placeholder="文章摘要，可为空"
        :rows="3"
      />
      <div class="markdown-editor-grid">
        <section class="markdown-editor-pane">
          <div class="pane-title">Markdown 正文</div>
          <Input.TextArea
            v-model:value="formState.markdownContent"
            class="markdown-input"
            placeholder="请输入 Markdown 正文"
            :rows="18"
          />
        </section>
        <section class="markdown-preview-pane">
          <div class="pane-title">实时预览</div>
          <div v-if="formState.markdownContent?.trim()" class="article-edit-preview">
            <div class="markdown-content" v-html="editorPreviewMarkdown"></div>
          </div>
          <Empty v-else description="输入 Markdown 后在这里预览" class="preview-empty" />
        </section>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.article-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  padding: 20px;
}

.page-header,
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.page-header h1,
.list-title h1 {
  margin: 0;
  color: #0f172a;
  font-weight: 800;
  line-height: 1.2;
}

.page-header h1 {
  font-size: 28px;
}

.list-title h1 {
  font-size: 24px;
}

.page-header p,
.list-title span,
.detail-meta {
  color: #64748b;
}

.page-header p {
  margin: 6px 0 0;
}

.list-heading {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14px;
}

.category-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
  grid-template-columns: minmax(280px, 520px) minmax(120px, 160px) minmax(140px, 220px);
  gap: 12px;
  align-items: center;
  justify-content: start;
}

.toolbar-search,
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

.article-list-panel,
.detail-panel {
  min-height: 0;
  overflow: auto;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.article-card {
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

.article-card:hover,
.article-card.active {
  border-color: #91caff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 8%);
  transform: translateY(-1px);
}

.article-card-head,
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.article-card-head h3 {
  margin: 0;
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.article-summary {
  display: -webkit-box;
  margin: 10px 0;
  overflow: hidden;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.article-meta,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.article-meta span {
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
  margin-bottom: 16px;
}

.detail-header h1 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
}

.reading-toolbar {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 14px;
}

.reading-settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
}

.toolbar-label {
  min-width: 52px;
  color: #64748b;
  text-align: center;
}

.reading-body {
  width: 100%;
  margin: 0 auto;
}

.article-reading-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  overflow: auto;
  border-radius: 0;
  padding: 28px;
}

.article-reading-fullscreen :deep(.ant-spin-nested-loading),
.article-reading-fullscreen :deep(.ant-spin-container) {
  min-height: 100%;
}

.markdown-content {
  overflow-wrap: anywhere;
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

.markdown-content :deep(a) {
  color: #1677ff;
  text-decoration: underline;
  word-break: break-all;
}

.markdown-content :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px auto;
  border-radius: 8px;
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
  max-width: 100%;
  overflow-x: auto;
  border-radius: 8px;
  background: #f8fafc;
  padding: 14px 16px;
}

.markdown-content :deep(pre code) {
  display: block;
  min-width: max-content;
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
  color: inherit;
  padding: 0;
}

.markdown-content :deep(table) {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 12px 0;
  overflow-x: auto;
  border-collapse: collapse;
  white-space: nowrap;
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

.empty-list,
.empty-detail {
  margin-top: 80px;
}

.empty-icon {
  color: #cbd5e1;
  font-size: 48px;
}

.category-form {
  width: 100%;
}

.sort-input {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px 140px;
  gap: 12px;
  margin-bottom: 12px;
}

.form-input,
.form-textarea {
  margin-top: 12px;
}

.markdown-editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  margin-top: 12px;
}

.pane-title {
  margin-bottom: 8px;
  color: #111827;
  font-weight: 700;
}

.markdown-input :deep(textarea) {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}

.article-edit-preview {
  min-height: 404px;
  max-height: 520px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
}

.preview-empty {
  min-height: 404px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  padding-top: 130px;
}

@media (max-width: 1024px) {
  .content-layout {
    grid-template-columns: 1fr;
  }

  .article-list-panel {
    max-height: 320px;
  }

  .form-grid,
  .markdown-editor-grid {
    grid-template-columns: 1fr;
  }

  .article-edit-preview,
  .preview-empty {
    min-height: 260px;
  }
}

@media (max-width: 640px) {
  .article-page {
    padding: 12px;
  }

  .page-header,
  .list-header,
  .detail-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .list-heading {
    width: 100%;
    flex-wrap: wrap;
  }

  .toolbar {
    grid-template-columns: 1fr;
  }

  .detail-panel,
  .article-reading-fullscreen {
    padding: 18px;
  }

  .reading-toolbar {
    align-items: flex-start;
  }

  .reading-settings {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
