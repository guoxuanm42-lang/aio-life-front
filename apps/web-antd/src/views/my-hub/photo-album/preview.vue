<script setup lang="ts">
import type { PhotoImage } from '#/api/core/photo-album';

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { usePreferences } from '@vben/preferences';

import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  UndoOutlined,
} from '@ant-design/icons-vue';
import { Button, Drawer, Empty, Spin } from 'ant-design-vue';

import {
  getPhotoImageBlob,
  queryPhotoImages,
} from '#/api/core/photo-album';

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const SCALE_STEP = 0.25;
const DEFAULT_RETURN_PATH = '/my-hub/photo-album';

const route = useRoute();
const router = useRouter();
const { isMobile } = usePreferences();
const isMobileView = computed(() => Boolean(unref(isMobile)));

const shellRef = ref<HTMLElement>();
const imageUrls = ref<Record<string, string>>({});
const imageBlobs = new Map<string, Blob>();
const imageLoadTasks = new Map<string, Promise<boolean>>();
const imageLoadingMap = ref<Record<string, boolean>>({});
const images = ref<PhotoImage[]>([]);
const standaloneImage = ref<PhotoImage | null>(null);
const currentIndex = ref(0);
const loading = ref(false);
const failed = ref(false);
const contextLoading = ref(false);
const contextWarning = ref('');
const infoOpen = ref(false);
const isFullscreen = ref(false);
const internalRouteChange = ref(false);

const transform = reactive({
  offsetX: 0,
  offsetY: 0,
  scale: 1,
});

const dragState = reactive({
  pointerId: -1,
  startOffsetX: 0,
  startOffsetY: 0,
  startX: 0,
  startY: 0,
});
let isDisposed = false;

const queryImageId = computed(() => getQueryString(route.query.id));
const queryFolderId = computed(() => getQueryString(route.query.folderId));
const returnPath = computed(() => {
  const from = getQueryString(route.query.from);
  return from && from.startsWith('/') ? from : DEFAULT_RETURN_PATH;
});
const hasContext = computed(() => images.value.length > 0);
const currentImage = computed(() => images.value[currentIndex.value] || standaloneImage.value);
const currentImageId = computed(() => currentImage.value?.id ? String(currentImage.value.id) : queryImageId.value);
const currentImageUrl = computed(() => currentImageId.value ? imageUrls.value[currentImageId.value] : undefined);
const canPrev = computed(() => hasContext.value && currentIndex.value > 0);
const canNext = computed(() => hasContext.value && currentIndex.value < images.value.length - 1);
const positionText = computed(() => hasContext.value ? `${currentIndex.value + 1} / ${images.value.length}` : '单图预览');
const zoomPercent = computed(() => `${Math.round(transform.scale * 100)}%`);
const imageStyle = computed(() => ({
  transform: `translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale})`,
}));

function getQueryString(value: unknown) {
  if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
  return value == null || value === '' ? undefined : String(value);
}

function getImageDisplayName(image?: PhotoImage | null) {
  return image?.title || image?.originalFilename || '未命名图片';
}

function formatFileSize(size?: number) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').slice(0, 120) || 'photo';
}

function resetTransform() {
  transform.scale = 1;
  transform.offsetX = 0;
  transform.offsetY = 0;
}

function changeScale(delta: number) {
  transform.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number((transform.scale + delta).toFixed(2))));
}

function revokeImageUrl(id: string) {
  const url = imageUrls.value[id];
  if (url) URL.revokeObjectURL(url);
  imageBlobs.delete(id);
  imageLoadTasks.delete(id);
  const { [id]: _url, ...nextUrls } = imageUrls.value;
  const { [id]: _loading, ...nextLoading } = imageLoadingMap.value;
  imageUrls.value = nextUrls;
  imageLoadingMap.value = nextLoading;
}

function revokeAllImageUrls() {
  Object.values(imageUrls.value).forEach((url) => URL.revokeObjectURL(url));
  imageUrls.value = {};
  imageLoadingMap.value = {};
  imageBlobs.clear();
  imageLoadTasks.clear();
}

function pruneCachedImageUrls(keepIds: Array<string | undefined>) {
  const keepSet = new Set(keepIds.filter(Boolean));
  Object.keys(imageUrls.value).forEach((id) => {
    if (!keepSet.has(id)) revokeImageUrl(id);
  });
}

async function ensureImageUrl(id?: string) {
  if (!id) return false;
  if (imageUrls.value[id]) return true;
  const existingTask = imageLoadTasks.get(id);
  if (existingTask) return await existingTask;
  imageLoadingMap.value = { ...imageLoadingMap.value, [id]: true };
  const task = (async () => {
    try {
      const blob = await getPhotoImageBlob(id);
      if (isDisposed) return false;
      imageBlobs.set(id, blob);
      imageUrls.value = { ...imageUrls.value, [id]: URL.createObjectURL(blob) };
      return true;
    } catch {
      revokeImageUrl(id);
      return false;
    } finally {
      imageLoadTasks.delete(id);
      imageLoadingMap.value = { ...imageLoadingMap.value, [id]: false };
    }
  })();
  imageLoadTasks.set(id, task);
  return await task;
}

async function loadCurrentImage() {
  failed.value = false;
  const id = currentImageId.value;
  if (!id) {
    failed.value = true;
    return;
  }
  loading.value = !imageUrls.value[id];
  const loaded = await ensureImageUrl(id);
  loading.value = false;
  failed.value = !loaded;
  if (hasContext.value) {
    const prevId = images.value[currentIndex.value - 1]?.id;
    const nextId = images.value[currentIndex.value + 1]?.id;
    pruneCachedImageUrls([id, prevId, nextId]);
    void ensureImageUrl(prevId);
    void ensureImageUrl(nextId);
  } else {
    pruneCachedImageUrls([id]);
  }
}

async function loadPreviewContext() {
  const id = queryImageId.value;
  const folderId = queryFolderId.value;
  resetTransform();
  failed.value = false;
  contextWarning.value = '';
  images.value = [];
  standaloneImage.value = id ? { folderId: folderId || '', id } : null;

  if (!id) {
    failed.value = true;
    contextWarning.value = '缺少图片 id，无法加载预览。';
    return;
  }

  if (!folderId) {
    contextWarning.value = '当前链接缺少 folderId，只能显示图片本体，无法恢复标题、页码和上一张/下一张。';
    await loadCurrentImage();
    return;
  }

  contextLoading.value = true;
  try {
    const page = await queryPhotoImages({ folderId, page: 1, pageSize: 120 });
    const nextImages = page.items || [];
    const nextIndex = nextImages.findIndex((item) => String(item.id) === id);
    if (nextIndex >= 0) {
      images.value = nextImages;
      currentIndex.value = nextIndex;
      standaloneImage.value = null;
    } else {
      contextWarning.value = '当前文件夹前 120 张中没有找到这张图片，只能显示图片本体。';
      standaloneImage.value = { folderId, id };
    }
  } catch {
    contextWarning.value = '图片列表加载失败，只能显示图片本体。';
    standaloneImage.value = { folderId, id };
  } finally {
    contextLoading.value = false;
  }
  await loadCurrentImage();
}

async function retryLoad() {
  const id = currentImageId.value;
  if (id) revokeImageUrl(id);
  await loadCurrentImage();
}

async function goBack() {
  await router.push(returnPath.value);
}

async function syncCurrentImageToUrl() {
  const id = currentImageId.value;
  if (!id) return;
  internalRouteChange.value = true;
  try {
    await router.replace({
      path: route.path,
      query: {
        ...route.query,
        folderId: currentImage.value?.folderId || queryFolderId.value,
        id,
      },
    });
    await nextTick();
  } finally {
    internalRouteChange.value = false;
  }
}

async function moveImage(step: -1 | 1) {
  if (!hasContext.value) return;
  const nextIndex = currentIndex.value + step;
  if (nextIndex < 0 || nextIndex >= images.value.length) return;
  currentIndex.value = nextIndex;
  resetTransform();
  await loadCurrentImage();
  await syncCurrentImageToUrl();
}

async function downloadCurrentImage() {
  const image = currentImage.value;
  const id = currentImageId.value;
  if (!id) return;
  let blob = imageBlobs.get(id);
  if (!blob) {
    blob = await getPhotoImageBlob(id);
    imageBlobs.set(id, blob);
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fallbackExt = image?.contentType?.split('/')[1] || 'jpg';
  link.href = url;
  link.download = sanitizeFilename(image?.title || image?.originalFilename || `photo-${id}.${fallbackExt}`);
  link.click();
  URL.revokeObjectURL(url);
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await shellRef.value?.requestFullscreen();
}

function handleFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === shellRef.value;
}

function handleWheel(event: WheelEvent) {
  event.preventDefault();
  changeScale(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0 || !currentImageUrl.value) return;
  dragState.pointerId = event.pointerId;
  dragState.startX = event.clientX;
  dragState.startY = event.clientY;
  dragState.startOffsetX = transform.offsetX;
  dragState.startOffsetY = transform.offsetY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (dragState.pointerId !== event.pointerId) return;
  transform.offsetX = dragState.startOffsetX + event.clientX - dragState.startX;
  transform.offsetY = dragState.startOffsetY + event.clientY - dragState.startY;
}

function stopDragging(event: PointerEvent) {
  if (dragState.pointerId !== event.pointerId) return;
  (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  dragState.pointerId = -1;
}

function handleDoubleClick() {
  if (transform.scale === 1) {
    transform.scale = 2;
    return;
  }
  resetTransform();
}

async function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (document.fullscreenElement) await document.exitFullscreen();
    else await goBack();
    return;
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    changeScale(SCALE_STEP);
    return;
  }
  if (event.key === '-') {
    event.preventDefault();
    changeScale(-SCALE_STEP);
    return;
  }
  if (event.key === '0') {
    event.preventDefault();
    resetTransform();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    await moveImage(-1);
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    await moveImage(1);
  }
}

onMounted(async () => {
  isDisposed = false;
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('keydown', handleKeydown);
  await loadPreviewContext();
});

watch(
  () => [route.query.id, route.query.folderId],
  async () => {
    if (internalRouteChange.value) return;
    await loadPreviewContext();
  },
);

onBeforeUnmount(() => {
  isDisposed = true;
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  window.removeEventListener('keydown', handleKeydown);
  revokeAllImageUrls();
});
</script>

<template>
  <div ref="shellRef" class="photo-preview-page" :class="{ fullscreen: isFullscreen }">
    <header class="preview-header">
      <Button class="ghost-button" type="text" @click="goBack">
        <ArrowLeftOutlined />
        返回相册
      </Button>
      <div class="preview-title">
        <strong>{{ getImageDisplayName(currentImage) }}</strong>
        <span>{{ positionText }}<template v-if="contextLoading"> · 正在恢复上下文</template></span>
      </div>
      <Button class="ghost-button icon-button" type="text" @click="toggleFullscreen">
        <FullscreenExitOutlined v-if="isFullscreen" />
        <FullscreenOutlined v-else />
      </Button>
    </header>

    <main class="preview-main">
      <Button class="preview-nav left" :disabled="!canPrev" shape="circle" @click="moveImage(-1)">
        <LeftOutlined />
      </Button>

      <div
        class="preview-stage"
        :class="{ dragging: dragState.pointerId >= 0 }"
        @dblclick="handleDoubleClick"
        @pointercancel="stopDragging"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="stopDragging"
        @wheel="handleWheel"
      >
        <Spin v-if="loading || contextLoading" />
        <img
          v-else-if="currentImageUrl"
          :alt="currentImage?.originalFilename || '图片预览'"
          draggable="false"
          :src="currentImageUrl"
          :style="imageStyle"
        />
        <Empty v-else-if="failed" description="图片加载失败">
          <Button @click="retryLoad"><ReloadOutlined />重试</Button>
        </Empty>
        <Empty v-else description="图片加载中" />
      </div>

      <Button class="preview-nav right" :disabled="!canNext" shape="circle" @click="moveImage(1)">
        <RightOutlined />
      </Button>
    </main>

    <footer class="preview-toolbar">
      <div v-if="contextWarning" class="context-warning">{{ contextWarning }}</div>
      <div class="toolbar-actions">
        <Button class="ghost-button" type="text" @click="changeScale(-SCALE_STEP)"><MinusOutlined /></Button>
        <Button class="ghost-button zoom-button" type="text" @click="resetTransform"><UndoOutlined />{{ zoomPercent }}</Button>
        <Button class="ghost-button" type="text" @click="changeScale(SCALE_STEP)"><PlusOutlined /></Button>
        <Button class="ghost-button" type="text" @click="downloadCurrentImage"><DownloadOutlined />下载</Button>
        <Button class="ghost-button" type="text" @click="infoOpen = true"><InfoCircleOutlined />信息</Button>
      </div>
    </footer>

    <Drawer v-model:open="infoOpen" :height="isMobileView ? '58vh' : undefined" :placement="isMobileView ? 'bottom' : 'right'" title="图片信息" width="360">
      <div class="image-info-list">
        <div><span>标题</span><strong>{{ getImageDisplayName(currentImage) }}</strong></div>
        <div><span>备注</span><strong>{{ currentImage?.caption || '-' }}</strong></div>
        <div><span>原始文件名</span><strong>{{ currentImage?.originalFilename || '-' }}</strong></div>
        <div><span>大小</span><strong>{{ formatFileSize(currentImage?.fileSize) }}</strong></div>
        <div><span>MIME 类型</span><strong>{{ currentImage?.contentType || '-' }}</strong></div>
        <div><span>上传时间</span><strong>{{ currentImage?.createTime || '-' }}</strong></div>
        <div><span>当前位置</span><strong>{{ positionText }}</strong></div>
        <div v-if="contextWarning"><span>上下文</span><strong>{{ contextWarning }}</strong></div>
      </div>
    </Drawer>
  </div>
</template>

<style scoped>
.photo-preview-page {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  color: #f8fafc;
  background: #080b12;
}

.preview-header,
.preview-toolbar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgb(8 11 18 / 88%);
  border-color: rgb(255 255 255 / 8%);
}

.preview-header {
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.preview-toolbar {
  justify-content: space-between;
  border-top: 1px solid rgb(255 255 255 / 8%);
}

.preview-title {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.preview-title strong {
  overflow: hidden;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-title span,
.context-warning {
  color: #a6adbb;
  font-size: 12px;
}

.context-warning {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ghost-button {
  color: #f8fafc;
}

.ghost-button:hover,
.ghost-button:focus {
  color: #fff;
  background: rgb(255 255 255 / 10%);
}

.icon-button {
  width: 36px;
  padding-inline: 0;
}

.preview-main {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.preview-stage.dragging {
  cursor: grabbing;
}

.preview-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.08s ease-out;
  transform-origin: center center;
  will-change: transform;
}

.preview-nav {
  position: absolute;
  top: 50%;
  z-index: 2;
  color: #f8fafc;
  background: rgb(8 11 18 / 54%);
  border: 1px solid rgb(255 255 255 / 10%);
  transform: translateY(-50%);
}

.preview-nav.left {
  left: 16px;
}

.preview-nav.right {
  right: 16px;
}

.preview-nav:not(:disabled):hover {
  color: #fff;
  background: rgb(255 255 255 / 14%);
}

.toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.zoom-button {
  min-width: 92px;
}

.image-info-list {
  display: grid;
  gap: 14px;
}

.image-info-list div {
  display: grid;
  gap: 4px;
}

.image-info-list span {
  color: #7b8494;
}

.image-info-list strong {
  overflow-wrap: anywhere;
  font-weight: 500;
}

@media (max-width: 768px) {
  .preview-header {
    padding: 10px 10px;
  }

  .preview-toolbar {
    display: grid;
    gap: 8px;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  }

  .toolbar-actions {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }

  .toolbar-actions :deep(.ant-btn) {
    padding-inline: 6px;
  }

  .context-warning {
    white-space: normal;
  }

  .preview-nav {
    display: none;
  }
}
</style>
