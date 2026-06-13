<script setup lang="ts">
import { SearchOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { IconifyIcon } from '@vben/icons';
import { Button, Card, Empty, Input, Spin } from 'ant-design-vue';

defineOptions({
  name: 'ThinkAllList',
});

type OptionItem = {
  label: string;
  value: string;
};

withDefaults(
  defineProps<{
    emptyDescription?: string;
    getCategoryIconByThemeKey?: (themeKey: any) => string;
    getCategoryTitleByThemeKey?: (themeKey: any) => string;
    getThoughtCardPreview?: (thought: any) => string;
    getThoughtCardTitle?: (thought: any) => string;
    getThoughtStatusDisplayLabel?: (status: any, thoughtType?: any) => string;
    getThoughtStyle?: (thought: any) => Record<string, any>;
    getThoughtThemeKey?: (thought: any) => any;
    getThoughtTypeLabel?: (thoughtType: any) => string;
    loading?: boolean;
    searchPlaceholder?: string;
    showTypeFilter?: boolean;
    statusFilter?: string;
    statusOptions?: OptionItem[];
    subjectKeyword?: string;
    thoughtTypeFilter?: string;
    thoughtTypeOptions?: OptionItem[];
    thoughts?: any[];
    formatDate?: (value: any) => string;
  }>(),
  {
    emptyDescription: '还没有任何闪念记录，点击右下角或下方按钮添加',
    formatDate: (value: any) => String(value ?? ''),
    getCategoryIconByThemeKey: () => '',
    getCategoryTitleByThemeKey: () => '',
    getThoughtCardPreview: () => '',
    getThoughtCardTitle: () => '',
    getThoughtStatusDisplayLabel: () => '',
    getThoughtStyle: () => ({}),
    getThoughtThemeKey: () => '',
    getThoughtTypeLabel: () => '',
    loading: false,
    searchPlaceholder: '搜索主题内容',
    showTypeFilter: true,
    statusFilter: 'all',
    statusOptions: () => [],
    subjectKeyword: '',
    thoughtTypeFilter: 'all',
    thoughtTypeOptions: () => [],
    thoughts: () => [],
  },
);

const emit = defineEmits<{
  add: [];
  edit: [id: number | string];
  search: [];
  'update:statusFilter': [value: string];
  'update:subjectKeyword': [value: string];
  'update:thoughtTypeFilter': [value: string];
}>();
</script>

<template>
  <div>
    <div class="think-header">
      <div class="think-status-capsule">
        <button
          v-for="item in statusOptions"
          :key="item.value"
          type="button"
          class="think-status-capsule-item"
          :class="{ 'is-active': statusFilter === item.value }"
          @click="emit('update:statusFilter', item.value)"
        >
          {{ item.label }}
        </button>
      </div>

      <div v-if="showTypeFilter" class="think-type-capsule">
        <button
          v-for="item in thoughtTypeOptions"
          :key="item.value"
          type="button"
          class="think-type-capsule-item"
          :class="{ 'is-active': thoughtTypeFilter === item.value }"
          @click="emit('update:thoughtTypeFilter', item.value)"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="think-subject-search">
        <Input
          :value="subjectKeyword"
          allow-clear
          class="think-subject-search-input"
          :placeholder="searchPlaceholder"
          @update:value="emit('update:subjectKeyword', String($event ?? ''))"
          @press-enter="emit('search')"
        >
          <template #prefix>
            <SearchOutlined />
          </template>
        </Input>
        <Button
          class="think-subject-search-button"
          type="primary"
          shape="round"
          @click="emit('search')"
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
          <Empty :description="emptyDescription">
            <Button type="primary" shape="round" size="large" @click="emit('add')">
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
          @click="emit('edit', thought.id)"
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
                <span class="protocol-pill-type">{{ getThoughtTypeLabel(thought.thoughtType) }}</span>
              </div>
              <h3 class="protocol-title">
                {{ getThoughtCardTitle(thought) }}
              </h3>
              <p v-if="getThoughtCardPreview(thought)" class="protocol-desc">
                {{ getThoughtCardPreview(thought) }}
              </p>
            </div>
            <div class="protocol-badge" :data-theme="getThoughtThemeKey(thought)"></div>
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
                  <IconifyIcon icon="lucide:message-circle" class="protocol-meta-count-icon" />
                  <span>{{ (thought.events || []).length }}</span>
                </span>
                <span class="protocol-meta-sep"></span>
                <span class="protocol-meta-status">
                  {{ getThoughtStatusDisplayLabel(thought.status, thought.thoughtType) }}
                </span>
              </div>
              <span class="protocol-arrow">›</span>
            </div>
          </div>
        </Card>
      </div>
    </Spin>
  </div>
</template>

<style scoped>
.think-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.think-status-capsule,
.think-type-capsule {
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
}

.think-status-capsule-item,
.think-type-capsule-item {
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
}

.think-status-capsule-item:hover,
.think-type-capsule-item:hover {
  background: rgb(255 255 255 / 0.55);
}

.think-status-capsule-item.is-active,
.think-type-capsule-item.is-active {
  background: rgb(var(--thought-accent-rgb, 22 119 255) / 0.18);
  color: rgb(var(--thought-accent-rgb, 22 119 255) / 0.92);
  box-shadow:
    0 10px 18px rgb(var(--thought-accent-rgb, 22 119 255) / 0.22),
    0 8px 16px rgb(0 0 0 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
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
}

.think-subject-search-input :deep(.ant-input) {
  background: transparent;
}

.think-subject-search-button {
  flex: 0 0 auto;
  min-height: 36px;
  font-weight: 700;
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
  position: relative;
  overflow: hidden;
  margin-bottom: 0;
  border: 3px solid rgb(255 255 255 / 0.8);
  border-radius: 16px;
  background:
    radial-gradient(circle at 80% 15%, rgb(var(--thought-accent-rgb) / 0.14) 0%, transparent 55%),
    radial-gradient(circle at 10% 90%, rgb(var(--thought-accent-rgb) / 0.08) 0%, transparent 55%),
    linear-gradient(135deg, rgb(255 255 255 / 0.85) 0%, rgb(var(--thought-accent-rgb) / 0.08) 35%, rgb(255 255 255 / 0.86) 100%);
  box-shadow:
    0 10px 24px rgb(0 0 0 / 6%),
    0 18px 46px rgb(var(--thought-accent-rgb) / 0.28),
    inset 0 0 0 3px rgb(var(--thought-accent-rgb) / 0.24),
    inset 0 0 0 4px rgb(255 255 255 / 0.48);
  transition:
    transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    box-shadow 0.32s cubic-bezier(0.25, 0.8, 0.25, 1),
    border-color 0.32s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.thought-card :deep(.ant-card-body) {
  display: flex;
  position: relative;
  z-index: 1;
  flex-direction: column;
  height: 100%;
  padding: 22px;
}

.thought-card:hover {
  transform: translateY(-6px);
  border-color: rgb(var(--thought-accent-rgb) / 0.32);
  box-shadow:
    0 18px 40px rgb(0 0 0 / 12%),
    0 18px 40px rgb(var(--thought-accent-rgb) / 0.26),
    inset 0 0 0 1px rgb(255 255 255 / 45%);
}

.protocol-top {
  display: flex;
  position: relative;
  z-index: 1;
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
}

.protocol-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 112px;
  width: 112px;
  height: 112px;
  overflow: hidden;
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.16);
  border-radius: 32px;
  background: rgb(255 255 255 / 0.65);
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

.protocol-pill {
  display: inline-flex;
  position: relative;
  z-index: 1;
  align-items: center;
  width: fit-content;
  gap: 4px;
  padding: 4px 10px;
  margin-top: -2px;
  margin-bottom: 6px;
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.18);
  border-radius: 4px;
  background: rgb(var(--thought-accent-rgb) / 0.1);
  color: rgb(var(--thought-accent-rgb) / 0.9);
  font-size: 11px;
  font-weight: 600;
  zoom: 0.6;
}

.protocol-pill-type {
  padding-left: 6px;
  margin-left: 4px;
  border-left: 1px solid rgb(var(--thought-accent-rgb) / 0.28);
  color: rgb(0 0 0 / 0.48);
  font-weight: 700;
}

.protocol-title {
  margin: 0 0 6px;
  font-size: calc(var(--font-size-base, 14px) + 2px);
  font-weight: 800;
  line-height: 1.35;
}

.protocol-desc {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: rgb(0 0 0 / 0.55);
  font-size: 11px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  white-space: pre-wrap;
  word-break: break-word;
}

.protocol-badge {
  position: absolute;
  top: -12px;
  right: -10px;
  width: 42px;
  height: 42px;
  border: 1px solid rgb(var(--thought-accent-rgb) / 0.22);
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 22%, rgb(255 255 255 / 0.9) 0%, rgb(255 255 255 / 0.55) 34%, transparent 62%),
    linear-gradient(145deg, rgb(255 255 255 / 0.78) 0%, rgb(var(--thought-accent-rgb) / 0.14) 42%, rgb(255 255 255 / 0.6) 100%);
}

.protocol-meta {
  display: flex;
  position: relative;
  z-index: 1;
  align-items: center;
  justify-content: space-between;
  padding-top: 6px;
}

.protocol-date {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: rgb(0 0 0 / 0.45);
  font-size: 12px;
  white-space: nowrap;
}

.protocol-date-icon,
.protocol-meta-count-icon {
  width: 14px;
  height: 14px;
  color: rgb(0 0 0 / 0.4);
}

.protocol-meta-right {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 10px;
}

.protocol-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border: 1px solid rgb(255 255 255 / 0.72);
  border-radius: 999px;
  background: rgb(255 255 255 / 0.6);
}

.protocol-meta-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgb(0 0 0 / 0.55);
  font-size: 12px;
}

.protocol-meta-sep {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.16);
}

.protocol-meta-status {
  color: rgb(var(--thought-accent-rgb) / 0.85);
  font-size: 12px;
  font-weight: 600;
}

.protocol-arrow {
  color: rgb(var(--thought-accent-rgb) / 0.85);
  font-size: 18px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.thought-card:hover .protocol-arrow {
  opacity: 1;
}

@media (max-width: 768px) {
  .think-status-capsule {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
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

  .protocol-top {
    gap: 12px;
    padding-right: 58px;
  }

  .protocol-icon {
    flex-basis: 56px;
    width: 56px;
    height: 56px;
    border-radius: 18px;
  }

  .protocol-desc {
    -webkit-line-clamp: 2;
  }
}

@media (min-width: 1536px) {
  .cards-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
