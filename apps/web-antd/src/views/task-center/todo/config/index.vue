<script lang="ts" setup>
import type { TaskType } from '#/api/core/todo';

import { computed, onMounted, ref } from 'vue';

import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue';
import {
  Button as AButton,
  Empty as AEmpty,
  Input as AInput,
  InputNumber as AInputNumber,
  Modal as AModal,
  Popconfirm as APopconfirm,
  Tag as ATag,
  message,
} from 'ant-design-vue';

import {
  deleteTaskType,
  getTaskTypeList,
  saveTaskType,
  updateTaskType,
} from '#/api/core/todo';

interface TypeForm {
  color?: string;
  id?: number;
  name: string;
  sortOrder?: number;
  theme?: string;
}

const DEFAULT_THEME_LABEL = '默认';
const CLASSIC_COLOR_SWATCHES = [
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#faad14',
  '#fa8c16',
  '#f5222d',
  '#eb2f96',
  '#722ed1',
  '#2f54eb',
  '#08979c',
  '#389e0d',
  '#d48806',
  '#d4380d',
  '#cf1322',
  '#c41d7f',
  '#531dab',
  '#475467',
  '#101828',
];

const loading = ref(false);
const saving = ref(false);
const modalVisible = ref(false);
const isEditing = ref(false);
const taskTypes = ref<TaskType[]>([]);
const form = ref<TypeForm>(createEmptyForm());

const modalTitle = computed(() => (isEditing.value ? '编辑类型' : '新增类型'));

onMounted(async () => {
  await loadTaskTypes();
});

function createEmptyForm(): TypeForm {
  return {
    color: '#1677ff',
    name: '',
    sortOrder: undefined,
    theme: '',
  };
}

async function loadTaskTypes() {
  loading.value = true;
  try {
    taskTypes.value = await getTaskTypeList();
  } catch (error) {
    console.error('加载类型配置失败', error);
    message.error('加载类型配置失败');
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  isEditing.value = false;
  form.value = createEmptyForm();
  modalVisible.value = true;
}

function openEditModal(type: TaskType) {
  isEditing.value = true;
  form.value = {
    color: type.color || '#1677ff',
    id: type.id,
    name: type.name,
    sortOrder: type.sortOrder,
    theme: type.theme || '',
  };
  modalVisible.value = true;
}

async function handleSave() {
  const name = form.value.name.trim();
  if (!name) {
    message.warning('请输入类型名称');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      color: form.value.color?.trim() || undefined,
      id: form.value.id,
      name,
      sortOrder: form.value.sortOrder,
      theme: form.value.theme?.trim() || undefined,
    };

    if (isEditing.value) {
      await updateTaskType(payload);
      message.success('类型已更新');
    } else {
      await saveTaskType(payload);
      message.success('类型已新增');
    }
    modalVisible.value = false;
    await loadTaskTypes();
  } catch (error) {
    console.error('保存类型失败', error);
    message.error('保存类型失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(type: TaskType) {
  try {
    await deleteTaskType({ id: type.id });
    message.success('类型已删除');
    await loadTaskTypes();
  } catch (error) {
    console.error('删除类型失败', error);
    message.error('删除类型失败');
  }
}

function getThemeLabel(type: TaskType) {
  return type.theme || DEFAULT_THEME_LABEL;
}

function selectClassicColor(color: string) {
  form.value.color = color;
}
</script>

<template>
  <div class="config-page">
    <div class="config-header">
      <div>
        <h2 class="config-title">类型配置</h2>
        <p class="config-subtitle">维护新增代办和筛选时可选择的类型。</p>
      </div>
      <AButton type="primary" @click="openCreateModal">
        <PlusOutlined />
        新增类型
      </AButton>
    </div>

    <div class="config-list">
      <div v-if="loading" class="config-empty">加载中...</div>
      <AEmpty
        v-else-if="taskTypes.length === 0"
        description="暂无类型，新增后可在代办里选择"
      />

      <article
        v-for="type in taskTypes"
        v-else
        :key="type.id"
        class="type-item"
      >
        <div class="type-main">
          <div class="type-color" :style="{ background: type.color || '#1677ff' }" />
          <div class="type-info">
            <div class="type-name-row">
              <h3 class="type-name">{{ type.name }}</h3>
              <ATag>{{ getThemeLabel(type) }}</ATag>
            </div>
            <div class="type-meta">
              排序 {{ type.sortOrder ?? '-' }}
              <span v-if="type.color"> · {{ type.color }}</span>
            </div>
          </div>
        </div>

        <div class="type-actions">
          <AButton @click="openEditModal(type)">
            <EditOutlined />
            编辑
          </AButton>
          <APopconfirm
            title="删除后历史代办会保留原类型名称，确认删除？"
            @confirm="handleDelete(type)"
          >
            <AButton danger>
              <DeleteOutlined />
              删除
            </AButton>
          </APopconfirm>
        </div>
      </article>
    </div>

    <AModal
      v-model:open="modalVisible"
      :confirm-loading="saving"
      :title="modalTitle"
      destroy-on-close
      @ok="handleSave"
    >
      <div class="form-stack">
        <label class="form-field">
          <span>类型名称</span>
          <AInput
            v-model:value="form.name"
            :maxlength="30"
            placeholder="例如：工作、学习、生活"
          />
        </label>

        <label class="form-field">
          <span>主题</span>
          <AInput
            v-model:value="form.theme"
            :maxlength="30"
            placeholder="不填则显示为默认"
          />
        </label>

        <label class="form-field">
          <span>颜色</span>
          <div class="color-row">
            <input v-model="form.color" class="color-input" type="color" />
            <AInput v-model:value="form.color" placeholder="#1677ff" />
          </div>
          <div class="classic-color-grid" aria-label="经典颜色">
            <button
              v-for="color in CLASSIC_COLOR_SWATCHES"
              :key="color"
              class="classic-color-swatch"
              :class="{ 'is-active': form.color?.toLowerCase() === color }"
              :style="{ background: color }"
              :title="color"
              type="button"
              @click="selectClassicColor(color)"
            />
          </div>
        </label>

        <label class="form-field">
          <span>排序</span>
          <AInputNumber
            v-model:value="form.sortOrder"
            :min="0"
            class="sort-input"
            placeholder="数字越小越靠前"
          />
        </label>
      </div>
    </AModal>
  </div>
</template>

<style scoped>
.config-page {
  min-height: 100%;
  padding: 28px 32px 48px;
  background: #f5f7fb;
}

.config-header {
  display: flex;
  width: min(1000px, 100%);
  margin: 0 auto 16px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.config-title {
  margin: 0;
  color: #101828;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0;
}

.config-subtitle {
  margin: 6px 0 0;
  color: #667085;
}

.config-list {
  display: grid;
  width: min(1000px, 100%);
  gap: 12px;
  margin: 0 auto;
}

.config-empty {
  padding: 42px;
  color: #667085;
  text-align: center;
}

.type-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
}

.type-main,
.type-actions,
.type-name-row,
.color-row {
  display: flex;
  align-items: center;
}

.type-main {
  gap: 12px;
  min-width: 0;
}

.type-actions,
.type-name-row,
.color-row {
  gap: 8px;
}

.type-color {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border: 1px solid rgb(0 0 0 / 8%);
  border-radius: 50%;
}

.type-info {
  min-width: 0;
}

.type-name {
  margin: 0;
  color: #101828;
  font-size: 17px;
  font-weight: 700;
}

.type-meta {
  margin-top: 4px;
  color: #667085;
  font-size: 13px;
}

.form-stack {
  display: grid;
  gap: 14px;
}

.form-field {
  display: grid;
  gap: 6px;
  color: #344054;
  font-size: 14px;
}

.color-input {
  width: 42px;
  height: 32px;
  padding: 0;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
}

.classic-color-grid {
  display: grid;
  grid-template-columns: repeat(9, 24px);
  gap: 8px;
  align-items: center;
  padding: 2px 0;
}

.classic-color-swatch {
  position: relative;
  width: 24px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  border: 1px solid rgb(16 24 40 / 12%);
  border-radius: 6px;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 28%);
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.classic-color-swatch:hover {
  box-shadow:
    0 0 0 3px rgb(22 119 255 / 12%),
    inset 0 1px 0 rgb(255 255 255 / 28%);
  transform: translateY(-1px);
}

.classic-color-swatch.is-active {
  box-shadow:
    0 0 0 2px #fff,
    0 0 0 4px #1677ff;
}

.sort-input {
  width: 100%;
}

@media (max-width: 768px) {
  .config-page {
    padding: 20px 14px 32px;
  }

  .config-header,
  .type-item {
    grid-template-columns: 1fr;
  }

  .config-header {
    display: grid;
  }

  .type-actions {
    justify-content: flex-start;
  }

  .classic-color-grid {
    grid-template-columns: repeat(6, 24px);
  }
}
</style>
