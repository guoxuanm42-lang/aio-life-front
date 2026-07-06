<script setup lang="ts">
import type { PhotoFolderTree, PhotoImage } from '#/api/core/photo-album';

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, unref, watch } from 'vue';

import { usePreferences } from '@vben/preferences';

import {
  AppstoreOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FolderAddOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  StarOutlined,
  SwapOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UploadOutlined,
} from '@ant-design/icons-vue';
import {
  Button,
  Drawer,
  Empty,
  FloatButton,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  SelectOption,
  Space,
  Spin,
  Textarea,
  Tree,
  Upload,
} from 'ant-design-vue';

import {
  clearPhotoFolderCover,
  createPhotoFolder,
  deletePhotoFolder,
  deletePhotoImage,
  getPhotoFolderTree,
  getPhotoImageBlob,
  movePhotoImage,
  queryPhotoImages,
  setPhotoFolderCover,
  updatePhotoImage,
  updatePhotoFolder,
  uploadPhotoImages,
} from '#/api/core/photo-album';

const { isMobile } = usePreferences();
const isMobileView = computed(() => Boolean(unref(isMobile)));

const folderTree = ref<PhotoFolderTree[]>([]);
const selectedFolderId = ref<string>();
const selectedKeys = computed(() =>
  selectedFolderId.value ? [selectedFolderId.value] : [],
);

const imageLoading = ref(false);
const folderLoading = ref(false);
const uploadLoading = ref(false);
const loadingMore = ref(false);
const images = ref<PhotoImage[]>([]);
const total = ref(0);
const imageUrlMap = ref<Record<string, string>>({});
const imageUrlLoadingMap = ref<Record<string, boolean>>({});
const imageUrlFailedMap = ref<Record<string, boolean>>({});
const imageBlobMap = new Map<string, Blob>();
const folderCoverUrlMap = ref<Record<string, string>>({});

const queryState = reactive({ keyword: '', page: 1, pageSize: 48 });
const viewMode = ref<'double' | 'single'>('double');
const folderModalOpen = ref(false);
const folderModalMode = ref<'create' | 'edit'>('create');
const folderForm = reactive({ name: '' });
const previewOpen = ref(false);
const previewIndex = ref(0);
const previewScale = ref(1);
const previewLoading = ref(false);
const previewFailed = ref(false);
const previewInfoOpen = ref(false);
const imageEditOpen = ref(false);
const imageMoveOpen = ref(false);
const editingImage = ref<PhotoImage | null>(null);
const imageEditForm = reactive({ caption: '', title: '' });
const moveTargetFolderId = ref<string>();
const mobileFileInputRef = ref<HTMLInputElement>();
const loadMoreSentinelRef = ref<HTMLElement>();
const imageItemRefs = new Map<string, HTMLElement>();
let imageObserver: IntersectionObserver | undefined;
let loadMoreObserver: IntersectionObserver | undefined;

const flatFolders = computed(() => {
  const result: Array<{ coverImageId?: string; id: string; imageCount?: number; label: string; name: string; parentId?: string }> = [];
  const walk = (nodes: PhotoFolderTree[], prefix = '') => {
    for (const node of nodes) {
      if (!node.id) continue;
      const label = prefix ? `${prefix} / ${node.name}` : node.name;
      result.push({
        id: String(node.id),
        coverImageId: node.coverImageId ? String(node.coverImageId) : undefined,
        imageCount: node.imageCount,
        label,
        name: node.name,
        parentId: node.parentId ? String(node.parentId) : undefined,
      });
      if (node.children?.length) walk(node.children, label);
    }
  };
  walk(folderTree.value);
  return result;
});

const antTreeData = computed(() => {
  const convert = (nodes: PhotoFolderTree[]): any[] =>
    nodes.filter((node) => Boolean(node.id)).map((node) => ({
      children: convert(node.children || []),
      key: String(node.id),
      title: `${node.name} (${node.imageCount || 0})`,
    }));
  return convert(folderTree.value);
});

const currentFolder = computed(() => flatFolders.value.find((item) => item.id === selectedFolderId.value));
const currentFolderPath = computed(() => currentFolder.value?.label || '请选择文件夹');
const currentFolderCoverUrl = computed(() => {
  const coverImageId = currentFolder.value?.coverImageId;
  return coverImageId ? folderCoverUrlMap.value[coverImageId] : undefined;
});
const currentPreviewImage = computed(() => images.value[previewIndex.value]);
const currentPreviewUrl = computed(() => {
  const id = currentPreviewImage.value?.id;
  return id ? imageUrlMap.value[id] : undefined;
});
const canUseFolderActions = computed(() => Boolean(selectedFolderId.value));
const hasMore = computed(() => images.value.length < total.value);
const photoGridClass = computed(() => ({ double: isMobileView.value && viewMode.value === 'double', single: isMobileView.value && viewMode.value === 'single' }));
const emptyStateType = computed(() => {
  if (!flatFolders.value.length) return 'no-folder';
  if (queryState.keyword.trim()) return 'no-search-result';
  return 'empty-folder';
});

async function loadFolders() {
  folderLoading.value = true;
  try {
    folderTree.value = await getPhotoFolderTree();
    if (!selectedFolderId.value && flatFolders.value.length > 0) selectedFolderId.value = flatFolders.value[0]?.id;
    await loadFolderCoverUrls();
  } finally {
    folderLoading.value = false;
  }
}

async function loadImages(resetPage = false, append = false) {
  if (!selectedFolderId.value) {
    images.value = [];
    total.value = 0;
    revokeImageUrls();
    return;
  }
  if (resetPage) queryState.page = 1;
  if (append) loadingMore.value = true;
  else {
    imageLoading.value = true;
    if (resetPage) {
      revokeImageUrls();
      images.value = [];
    }
  }
  try {
    const page = await queryPhotoImages({ folderId: selectedFolderId.value, keyword: queryState.keyword.trim() || undefined, page: queryState.page, pageSize: queryState.pageSize });
    const nextItems = page.items || [];
    images.value = append ? [...images.value, ...nextItems] : nextItems;
    total.value = page.total || 0;
    await nextTick();
    observeImageItems();
    observeLoadMore();
  } finally {
    imageLoading.value = false;
    loadingMore.value = false;
  }
}

async function loadNextPage() {
  if (!isMobileView.value || loadingMore.value || imageLoading.value || !hasMore.value) return;
  queryState.page += 1;
  await loadImages(false, true);
}

function revokeImageUrl(id: string) {
  const url = imageUrlMap.value[id];
  if (url) URL.revokeObjectURL(url);
  imageBlobMap.delete(id);
  const { [id]: _url, ...nextUrls } = imageUrlMap.value;
  const { [id]: _loading, ...nextLoading } = imageUrlLoadingMap.value;
  const { [id]: _failed, ...nextFailed } = imageUrlFailedMap.value;
  imageUrlMap.value = nextUrls;
  imageUrlLoadingMap.value = nextLoading;
  imageUrlFailedMap.value = nextFailed;
}

function revokeImageUrls() {
  Object.values(imageUrlMap.value).forEach((url) => URL.revokeObjectURL(url));
  imageUrlMap.value = {};
  imageUrlLoadingMap.value = {};
  imageUrlFailedMap.value = {};
  imageBlobMap.clear();
}

function revokeFolderCoverUrls() {
  Object.values(folderCoverUrlMap.value).forEach((url) => URL.revokeObjectURL(url));
  folderCoverUrlMap.value = {};
}

async function ensureImageUrl(id?: string) {
  if (!id || imageUrlMap.value[id] || imageUrlLoadingMap.value[id]) return;
  imageUrlLoadingMap.value = { ...imageUrlLoadingMap.value, [id]: true };
  imageUrlFailedMap.value = { ...imageUrlFailedMap.value, [id]: false };
  try {
    const blob = await getPhotoImageBlob(id);
    imageBlobMap.set(id, blob);
    imageUrlMap.value = { ...imageUrlMap.value, [id]: URL.createObjectURL(blob) };
  } catch {
    imageUrlFailedMap.value = { ...imageUrlFailedMap.value, [id]: true };
  } finally {
    imageUrlLoadingMap.value = { ...imageUrlLoadingMap.value, [id]: false };
  }
}

async function loadFolderCoverUrls() {
  revokeFolderCoverUrls();
  const coverIds = Array.from(new Set(flatFolders.value.map((folder) => folder.coverImageId).filter(Boolean))) as string[];
  const entries = await Promise.all(coverIds.map(async (id) => {
    try {
      const blob = await getPhotoImageBlob(id);
      return [id, URL.createObjectURL(blob)] as const;
    } catch {
      return [id, ''] as const;
    }
  }));
  folderCoverUrlMap.value = Object.fromEntries(entries.filter(([, url]) => url));
}

function setImageItemRef(el: any, id?: string) {
  if (!id) return;
  if (el instanceof HTMLElement) imageItemRefs.set(id, el);
  else imageItemRefs.delete(id);
}

function observeImageItems() {
  if (!imageObserver || typeof IntersectionObserver === 'undefined') {
    images.value.forEach((image) => void ensureImageUrl(image.id));
    return;
  }
  imageObserver.disconnect();
  for (const image of images.value) {
    if (!image.id || imageUrlMap.value[image.id]) continue;
    const el = imageItemRefs.get(image.id);
    if (el) imageObserver.observe(el);
  }
}

function observeLoadMore() {
  if (!loadMoreObserver || !loadMoreSentinelRef.value) return;
  loadMoreObserver.disconnect();
  loadMoreObserver.observe(loadMoreSentinelRef.value);
}

function openCreateFolderModal() {
  folderModalMode.value = 'create';
  folderForm.name = '';
  folderModalOpen.value = true;
}

function openEditFolderModal() {
  if (!currentFolder.value) {
    message.warning('请先选择文件夹');
    return;
  }
  folderModalMode.value = 'edit';
  folderForm.name = currentFolder.value.name;
  folderModalOpen.value = true;
}

async function saveFolder() {
  const name = folderForm.name.trim();
  if (!name) {
    message.warning('请输入文件夹名称');
    return;
  }
  if (folderModalMode.value === 'create') {
    const created = await createPhotoFolder({ name, parentId: selectedFolderId.value });
    selectedFolderId.value = created.id ? String(created.id) : selectedFolderId.value;
    message.success('文件夹已创建');
  } else if (selectedFolderId.value) {
    await updatePhotoFolder({ id: selectedFolderId.value, name });
    message.success('文件夹已更新');
  }
  folderModalOpen.value = false;
  await loadFolders();
}

async function removeFolder() {
  if (!selectedFolderId.value) return;
  await deletePhotoFolder(selectedFolderId.value);
  selectedFolderId.value = undefined;
  message.success('文件夹已删除');
  await loadFolders();
  await loadImages(true);
}

function handleTreeSelect(keys: Array<number | string>) {
  selectedFolderId.value = keys[0] ? String(keys[0]) : undefined;
}

function beforeUpload(file: File & { uid?: string }, fileList: Array<File & { uid?: string }>) {
  const last = fileList[fileList.length - 1];
  if (file.uid === last?.uid) void uploadBatch(fileList);
  return false;
}

function triggerMobileUpload() {
  if (!selectedFolderId.value) {
    message.warning('请先选择文件夹');
    return;
  }
  mobileFileInputRef.value?.click();
}

async function handleNativeUploadChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const fileList = Array.from(target.files || []);
  target.value = '';
  if (fileList.length) await uploadBatch(fileList);
}

async function uploadBatch(fileList: File[]) {
  if (!selectedFolderId.value) {
    message.warning('请先选择文件夹');
    return;
  }
  const data = new FormData();
  data.append('folderId', selectedFolderId.value);
  fileList.forEach((file) => data.append('files', file));
  uploadLoading.value = true;
  try {
    const result = await uploadPhotoImages(data);
    const successCount = result.successList?.length || 0;
    const failureList = result.failureList || [];
    if (successCount > 0) message.success(`成功上传 ${successCount} 张图片`);
    if (failureList.length > 0) {
      Modal.warning({ title: '部分图片上传失败', content: failureList.map((item) => `${item.filename}: ${item.reason}`).join('\n') });
    }
    await loadFolders();
    await loadImages(true);
  } finally {
    uploadLoading.value = false;
  }
}

async function openPreview(index: number) {
  previewIndex.value = index;
  previewScale.value = 1;
  previewFailed.value = false;
  previewOpen.value = true;
  await ensurePreviewImage();
}

async function ensurePreviewImage() {
  const image = currentPreviewImage.value;
  if (!image?.id) return;
  previewLoading.value = !imageUrlMap.value[image.id];
  previewFailed.value = false;
  await ensureImageUrl(image.id);
  previewFailed.value = Boolean(imageUrlFailedMap.value[image.id]);
  previewLoading.value = false;
  void ensureImageUrl(images.value[previewIndex.value - 1]?.id);
  void ensureImageUrl(images.value[previewIndex.value + 1]?.id);
}

function movePreview(step: -1 | 1) {
  if (!images.value.length) return;
  previewIndex.value = (previewIndex.value + step + images.value.length) % images.value.length;
  previewScale.value = 1;
  void ensurePreviewImage();
}

function changePreviewScale(delta: number) {
  previewScale.value = Math.min(4, Math.max(1, Number((previewScale.value + delta).toFixed(1))));
}

function resetPreviewScale() {
  previewScale.value = 1;
}

function formatFileSize(size?: number) {
  if (!size) return '-';
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getImageDisplayName(image: PhotoImage) {
  return image.title || image.originalFilename || '未命名图片';
}

function sanitizeFilename(name: string) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').slice(0, 120) || 'photo';
}

async function savePreviewImage() {
  const image = currentPreviewImage.value;
  if (!image?.id) return;
  let blob = imageBlobMap.get(image.id);
  if (!blob) {
    blob = await getPhotoImageBlob(image.id);
    imageBlobMap.set(image.id, blob);
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fallbackExt = image.contentType?.split('/')[1] || 'jpg';
  link.href = url;
  link.download = sanitizeFilename(image.title || image.originalFilename || `photo-${image.id}.${fallbackExt}`);
  link.click();
  URL.revokeObjectURL(url);
}

function openImageEdit(image: PhotoImage) {
  editingImage.value = image;
  imageEditForm.title = image.title || '';
  imageEditForm.caption = image.caption || '';
  imageEditOpen.value = true;
}

async function saveImageEdit() {
  if (!editingImage.value?.id) return;
  await updatePhotoImage({ caption: imageEditForm.caption, id: editingImage.value.id, title: imageEditForm.title });
  imageEditOpen.value = false;
  message.success('图片信息已更新');
  await loadImages();
  if (previewOpen.value) await ensurePreviewImage();
}

function openImageMove(image: PhotoImage) {
  editingImage.value = image;
  moveTargetFolderId.value = selectedFolderId.value;
  imageMoveOpen.value = true;
}

async function saveImageMove() {
  if (!editingImage.value?.id || !moveTargetFolderId.value) return;
  await movePhotoImage({ id: editingImage.value.id, targetFolderId: moveTargetFolderId.value });
  imageMoveOpen.value = false;
  message.success('图片已移动');
  await loadFolders();
  await loadImages(true);
}

async function removeImage(image: PhotoImage, keepPreview = false) {
  if (!image.id) return;
  await deletePhotoImage(image.id);
  message.success('图片已删除');
  revokeImageUrl(image.id);
  images.value = images.value.filter((item) => item.id !== image.id);
  total.value = Math.max(0, total.value - 1);
  await loadFolders();
  if (keepPreview) {
    if (!images.value.length) {
      previewOpen.value = false;
      return;
    }
    previewIndex.value = Math.min(previewIndex.value, images.value.length - 1);
    previewScale.value = 1;
    await ensurePreviewImage();
    return;
  }
  await loadImages();
}

async function removePreviewImage() {
  if (!currentPreviewImage.value) return;
  await removeImage(currentPreviewImage.value, true);
}

async function setAsCover(image: PhotoImage) {
  if (!selectedFolderId.value || !image.id) return;
  await setPhotoFolderCover({ folderId: selectedFolderId.value, imageId: image.id });
  message.success('封面已设置');
  await loadFolders();
}

async function clearCurrentCover() {
  if (!selectedFolderId.value) return;
  await clearPhotoFolderCover(selectedFolderId.value);
  message.success('封面已清除');
  await loadFolders();
}

function clearKeyword() {
  queryState.keyword = '';
  void loadImages(true);
}

watch(selectedFolderId, () => {
  void loadImages(true);
});

watch(isMobileView, () => {
  queryState.page = 1;
  void loadImages(true);
});

onMounted(async () => {
  if (typeof IntersectionObserver !== 'undefined') {
    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = (entry.target as HTMLElement).dataset.imageId;
        if (id) void ensureImageUrl(id);
        imageObserver?.unobserve(entry.target);
      });
    }, { rootMargin: '420px 0px' });
    loadMoreObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
    }, { rootMargin: '320px 0px' });
  }
  await loadFolders();
  await loadImages();
});

onBeforeUnmount(() => {
  imageObserver?.disconnect();
  loadMoreObserver?.disconnect();
  revokeImageUrls();
  revokeFolderCoverUrls();
});
</script>

<template>
  <div class="photo-album-page">
    <section class="album-toolbar">
      <div class="album-title-wrap">
        <div class="folder-cover">
          <img v-if="currentFolderCoverUrl" :src="currentFolderCoverUrl" alt="文件夹封面" />
          <span v-else>相册</span>
        </div>
        <div class="album-title-content">
          <h2>相册</h2>
          <p>{{ currentFolderPath }}</p>
          <small v-if="currentFolder">{{ currentFolder.imageCount || 0 }} 张图片</small>
        </div>
      </div>
      <Space v-if="!isMobileView" wrap>
        <Button @click="loadFolders"><ReloadOutlined /></Button>
        <Button type="primary" @click="openCreateFolderModal"><FolderAddOutlined />新建文件夹</Button>
        <Button :disabled="!canUseFolderActions" @click="openEditFolderModal"><EditOutlined />改名</Button>
        <Popconfirm title="只能删除空文件夹，确认删除？" @confirm="removeFolder">
          <Button danger :disabled="!canUseFolderActions"><DeleteOutlined /></Button>
        </Popconfirm>
        <Button :disabled="!currentFolder?.coverImageId" @click="clearCurrentCover">清除封面</Button>
      </Space>
    </section>

    <div class="album-layout" :class="{ mobile: isMobileView }">
      <aside v-if="!isMobileView" class="folder-panel">
        <Spin :spinning="folderLoading">
          <Tree :selected-keys="selectedKeys" :tree-data="antTreeData" block-node default-expand-all @select="handleTreeSelect" />
          <Empty v-if="!folderTree.length" description="暂无文件夹">
            <Button type="primary" @click="openCreateFolderModal">新建第一个相册</Button>
          </Empty>
        </Spin>
      </aside>

      <main class="image-panel">
        <div v-if="isMobileView" class="mobile-topbar">
          <Select v-model:value="selectedFolderId" class="folder-select" placeholder="选择文件夹">
            <SelectOption v-for="folder in flatFolders" :key="folder.id" :value="folder.id">
              {{ folder.label }} ({{ folder.imageCount || 0 }})
            </SelectOption>
          </Select>
          <div class="mobile-folder-actions">
            <Button size="small" @click="openCreateFolderModal"><FolderAddOutlined /></Button>
            <Button size="small" :disabled="!canUseFolderActions" @click="openEditFolderModal"><EditOutlined /></Button>
            <Button size="small" @click="viewMode = viewMode === 'double' ? 'single' : 'double'">
              <AppstoreOutlined v-if="viewMode === 'single'" />
              <UnorderedListOutlined v-else />
            </Button>
          </div>
        </div>

        <div class="image-actions">
          <Input v-model:value="queryState.keyword" class="image-search" placeholder="搜索标题、备注或文件名" allow-clear @press-enter="loadImages(true)" />
          <Button :disabled="!selectedFolderId" @click="loadImages(true)"><SearchOutlined />搜索</Button>
          <Upload v-if="!isMobileView" :before-upload="beforeUpload" :disabled="!selectedFolderId || uploadLoading" :multiple="true" :show-upload-list="false" accept="image/jpeg,image/png,image/webp,image/gif">
            <Button type="primary" :loading="uploadLoading"><UploadOutlined />批量上传</Button>
          </Upload>
          <Button :disabled="!selectedFolderId" @click="loadImages(true)"><ReloadOutlined />刷新</Button>
        </div>

        <Spin :spinning="imageLoading && !images.length">
          <div v-if="images.length" class="photo-grid" :class="photoGridClass">
            <div v-for="(image, index) in images" :key="image.id" :ref="(el) => setImageItemRef(el, image.id)" :data-image-id="image.id" class="photo-item" @click="openPreview(index)">
              <img v-if="image.id && imageUrlMap[image.id]" :alt="image.originalFilename || '相册图片'" :src="imageUrlMap[image.id]" loading="lazy" />
              <div v-else-if="image.id && imageUrlLoadingMap[image.id]" class="photo-placeholder"><Spin /></div>
              <div v-else-if="image.id && imageUrlFailedMap[image.id]" class="photo-placeholder retry" @click.stop="ensureImageUrl(image.id)">加载失败，点击重试</div>
              <div v-else class="photo-placeholder">加载中</div>
              <div class="photo-overlay">
                <div class="photo-title">
                  <span>{{ getImageDisplayName(image) }}</span>
                  <small>{{ formatFileSize(image.fileSize) }}</small>
                </div>
                <div class="photo-actions" @click.stop>
                  <Button size="small" type="text" @click="openImageEdit(image)"><EditOutlined /></Button>
                  <Button size="small" type="text" @click="openImageMove(image)"><SwapOutlined /></Button>
                  <Button size="small" type="text" @click="setAsCover(image)"><StarOutlined /></Button>
                  <Popconfirm title="确认删除这张图片？" @confirm="removeImage(image)">
                    <Button danger size="small" type="text"><DeleteOutlined /></Button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          </div>
          <Empty v-else class="album-empty" :description="emptyStateType === 'no-folder' ? '还没有相册文件夹' : emptyStateType === 'no-search-result' ? '没有找到匹配的图片' : '当前文件夹还没有照片'">
            <Button v-if="emptyStateType === 'no-folder'" type="primary" @click="openCreateFolderModal">新建第一个相册</Button>
            <Button v-else-if="emptyStateType === 'no-search-result'" @click="clearKeyword">清空搜索</Button>
            <Upload v-else-if="!isMobileView" :before-upload="beforeUpload" :disabled="!selectedFolderId || uploadLoading" :multiple="true" :show-upload-list="false" accept="image/jpeg,image/png,image/webp,image/gif">
              <Button type="primary" :loading="uploadLoading">上传照片</Button>
            </Upload>
            <Button v-else type="primary" :loading="uploadLoading" @click="triggerMobileUpload">上传照片</Button>
          </Empty>
        </Spin>

        <div ref="loadMoreSentinelRef" class="load-more-sentinel">
          <Spin v-if="loadingMore" />
          <span v-else-if="isMobileView && images.length && !hasMore">已显示全部</span>
        </div>

        <Pagination v-if="!isMobileView && total > queryState.pageSize" v-model:current="queryState.page" v-model:page-size="queryState.pageSize" :page-size-options="[24, 48, 72, 120]" :show-size-changer="true" :total="total" class="album-pagination" @change="() => loadImages()" />
      </main>
    </div>

    <input ref="mobileFileInputRef" class="hidden-file-input" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" @change="handleNativeUploadChange" />
    <FloatButton v-if="isMobileView" class="album-float-upload" type="primary" @click="triggerMobileUpload">
      <template #icon><UploadOutlined /></template>
    </FloatButton>

    <Modal v-model:open="folderModalOpen" :title="folderModalMode === 'create' ? '新建文件夹' : '文件夹改名'" @ok="saveFolder">
      <Form layout="vertical">
        <FormItem label="文件夹名称" required>
          <Input v-model:value="folderForm.name" :maxlength="100" placeholder="例如：五峰山" />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="previewOpen"
      :closable="false"
      :footer="null"
      :width="'100vw'"
      centered
      class="photo-preview-modal"
    >
      <div class="preview-shell">
        <div class="preview-topbar">
          <span>{{ currentPreviewImage ? getImageDisplayName(currentPreviewImage) : '未命名图片' }}</span>
          <small>{{ previewIndex + 1 }} / {{ images.length }}</small>
        </div>
        <Button class="preview-close" shape="circle" type="text" @click="previewOpen = false">×</Button>
        <Button class="preview-nav left" shape="circle" @click="movePreview(-1)"><LeftOutlined /></Button>
        <div class="preview-stage">
          <Spin v-if="previewLoading" />
          <img v-else-if="currentPreviewUrl" :alt="currentPreviewImage?.originalFilename || '图片预览'" :src="currentPreviewUrl" :style="{ transform: `scale(${previewScale})` }" />
          <Empty v-else-if="previewFailed" description="大图加载失败"><Button @click="ensurePreviewImage">重试</Button></Empty>
          <Empty v-else description="图片加载中" />
        </div>
        <Button class="preview-nav right" shape="circle" @click="movePreview(1)"><RightOutlined /></Button>
        <div class="preview-tools">
          <Button @click="changePreviewScale(-0.25)"><MinusOutlined /></Button>
          <Button @click="resetPreviewScale"><UndoOutlined />{{ previewScale.toFixed(1) }}x</Button>
          <Button @click="changePreviewScale(0.25)"><PlusOutlined /></Button>
          <Button @click="savePreviewImage"><DownloadOutlined /></Button>
          <Button @click="previewInfoOpen = true"><InfoCircleOutlined /></Button>
          <Button v-if="!isMobileView" @click="currentPreviewImage && openImageEdit(currentPreviewImage)"><EditOutlined /></Button>
          <Popconfirm title="确认删除这张图片？" @confirm="removePreviewImage"><Button danger><DeleteOutlined /></Button></Popconfirm>
        </div>
        <div v-if="isMobileView" class="preview-bottom-actions">
          <Button type="text" @click="savePreviewImage"><DownloadOutlined />保存</Button>
          <Button type="text" @click="previewInfoOpen = true"><InfoCircleOutlined />信息</Button>
          <Button type="text" @click="currentPreviewImage && openImageEdit(currentPreviewImage)"><EditOutlined />编辑</Button>
          <Popconfirm title="确认删除这张图片？" @confirm="removePreviewImage"><Button danger type="text"><DeleteOutlined />删除</Button></Popconfirm>
        </div>
      </div>
    </Modal>

    <Drawer v-model:open="previewInfoOpen" :height="isMobileView ? '58vh' : undefined" :placement="isMobileView ? 'bottom' : 'right'" title="图片信息" width="360">
      <div v-if="currentPreviewImage" class="image-info-list">
        <div><span>标题</span><strong>{{ getImageDisplayName(currentPreviewImage) }}</strong></div>
        <div><span>备注</span><strong>{{ currentPreviewImage.caption || '-' }}</strong></div>
        <div><span>原始文件名</span><strong>{{ currentPreviewImage.originalFilename || '-' }}</strong></div>
        <div><span>大小</span><strong>{{ formatFileSize(currentPreviewImage.fileSize) }}</strong></div>
        <div><span>上传时间</span><strong>{{ currentPreviewImage.createTime || '-' }}</strong></div>
        <div><span>当前位置</span><strong>{{ previewIndex + 1 }} / {{ images.length }}</strong></div>
      </div>
    </Drawer>

    <Modal v-model:open="imageEditOpen" title="编辑图片信息" @ok="saveImageEdit">
      <Form layout="vertical">
        <FormItem label="标题"><Input v-model:value="imageEditForm.title" :maxlength="100" placeholder="给图片起个标题" /></FormItem>
        <FormItem label="备注"><Textarea v-model:value="imageEditForm.caption" :maxlength="255" :rows="4" placeholder="记录地点、人物或当时的感受" /></FormItem>
      </Form>
    </Modal>

    <Modal v-model:open="imageMoveOpen" title="移动图片" @ok="saveImageMove">
      <Form layout="vertical">
        <FormItem label="目标文件夹" required>
          <Select v-model:value="moveTargetFolderId" class="folder-select">
            <SelectOption v-for="folder in flatFolders" :key="folder.id" :value="folder.id">{{ folder.label }}</SelectOption>
          </Select>
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
.photo-album-page {
  min-height: calc(100vh - 120px);
  padding: 16px;
  background: #f6f7fb;
}

.album-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.album-title-wrap {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.album-title-content {
  min-width: 0;
}

.folder-cover {
  display: flex;
  flex: 0 0 60px;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  overflow: hidden;
  color: #57606f;
  background: #e8edf5;
  border-radius: 8px;
}

.folder-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-toolbar h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 650;
}

.album-toolbar p {
  max-width: min(68vw, 720px);
  margin: 4px 0 0;
  overflow: hidden;
  color: #57606f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-toolbar small {
  color: #7b8494;
}

.album-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 12px;
}

.album-layout.mobile {
  display: block;
}

.folder-panel,
.image-panel {
  min-height: 520px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.folder-panel {
  overflow: auto;
}

.mobile-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  margin-bottom: 10px;
}

.mobile-folder-actions {
  display: flex;
  gap: 6px;
}

.image-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.image-search {
  max-width: 320px;
}

.folder-select {
  width: 100%;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.photo-item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  cursor: zoom-in;
  background: #eef2f7;
  border-radius: 8px;
  isolation: isolate;
}

.photo-item img,
.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  color: #7b8494;
  object-fit: cover;
  background: #edf1f7;
}

.photo-placeholder.retry {
  cursor: pointer;
}

.photo-overlay {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  padding: 36px 8px 8px;
  color: #fff;
  background: linear-gradient(180deg, rgb(0 0 0 / 0%) 0%, rgb(0 0 0 / 64%) 100%);
  opacity: 0;
  transition: opacity 0.16s ease;
}

.photo-item:hover .photo-overlay,
.photo-item:focus-within .photo-overlay {
  opacity: 1;
}

.photo-title {
  min-width: 0;
}

.photo-title span,
.photo-title small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.photo-title span {
  font-size: 13px;
  font-weight: 600;
}

.photo-title small {
  color: #d8dee9;
}

.photo-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
}

.photo-actions :deep(.ant-btn) {
  color: #fff;
}

.album-empty {
  padding: 72px 0;
}

.load-more-sentinel {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  color: #7b8494;
}

.album-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.hidden-file-input {
  display: none;
}

.album-float-upload {
  right: 22px;
  bottom: 76px;
}

:deep(.photo-preview-modal) {
  top: 0;
  max-width: 100vw;
  padding-bottom: 0;
}

:deep(.photo-preview-modal .ant-modal-content) {
  width: 100vw;
  height: 100vh;
  padding: 0;
  overflow: hidden;
  background: #080b12;
  border-radius: 0;
  box-shadow: none;
}

:deep(.photo-preview-modal .ant-modal-body) {
  width: 100vw;
  height: 100vh;
  padding: 0;
}

.preview-shell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
  background: #080b12;
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  overflow: auto;
}

.preview-stage img {
  max-width: 100%;
  max-height: 100vh;
  object-fit: contain;
  transition: transform 0.12s ease;
  transform-origin: center center;
}

.preview-topbar {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px 40px;
  color: #fff;
  background: linear-gradient(180deg, rgb(0 0 0 / 62%) 0%, rgb(0 0 0 / 0%) 100%);
}

.preview-topbar span {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-topbar small {
  flex: 0 0 auto;
  color: #d8dee9;
}

.preview-close {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 5;
  width: 36px;
  height: 36px;
  color: #fff;
  font-size: 28px;
  line-height: 1;
  background: rgb(8 11 18 / 48%);
}

.preview-close:hover {
  color: #fff;
  background: rgb(8 11 18 / 72%);
}

.preview-nav {
  position: absolute;
  top: 50%;
  z-index: 3;
  transform: translateY(-50%);
}

.preview-nav.left {
  left: 12px;
}

.preview-nav.right {
  right: 12px;
}

.preview-tools {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 3;
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgb(8 11 18 / 68%);
  border-radius: 8px;
}

.preview-bottom-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  background: rgb(8 11 18 / 86%);
}

.preview-bottom-actions :deep(.ant-btn) {
  height: 44px;
  color: #fff;
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
  .photo-album-page {
    padding: 8px 8px 72px;
    background: #f7f8fb;
  }

  .album-toolbar {
    margin-bottom: 8px;
  }

  .folder-cover {
    flex-basis: 44px;
    width: 44px;
    height: 44px;
  }

  .album-toolbar h2 {
    font-size: 18px;
  }

  .album-toolbar p {
    max-width: calc(100vw - 86px);
    font-size: 13px;
  }

  .image-panel {
    min-height: auto;
    padding: 0;
    background: transparent;
    border: 0;
  }

  .image-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 6px;
    margin-bottom: 8px;
  }

  .image-search {
    max-width: none;
    width: 100%;
  }

  .image-actions :deep(.ant-btn) {
    padding-inline: 10px;
  }

  .photo-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .photo-grid.single {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .photo-grid.single .photo-item img,
  .photo-grid.single .photo-placeholder {
    aspect-ratio: 4 / 5;
  }

  .photo-grid.double {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .photo-item {
    border-radius: 4px;
  }

  .photo-overlay {
    padding: 28px 6px 6px;
    opacity: 1;
  }

  .photo-title small,
  .photo-actions {
    display: none;
  }

  .preview-shell,
  .preview-stage {
    min-height: 100vh;
    height: 100vh;
  }

  .preview-stage img {
    max-height: calc(100vh - 72px);
  }

  .preview-tools {
    right: 8px;
    bottom: 72px;
    left: 8px;
    justify-content: center;
  }

  .preview-tools > :deep(.ant-btn:nth-last-child(-n + 3)) {
    display: none;
  }

  .preview-nav {
    display: none;
  }
}
</style>
