<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRaw, watch } from 'vue';
import { useRoute } from 'vue-router';

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { IconifyIcon } from '@vben/icons';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Spin,
} from 'ant-design-vue';

import {
  deleteData as deleteThink,
  query as queryThink,
  save as saveThink,
  update as updateThink,
} from '#/api/core/think';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

type ThemeKey = 'blue' | 'cyan' | 'green' | 'purple' | 'pink' | 'orange';
type ThoughtStatus = 'pending' | 'ongoing' | 'done' | 'archived';
type ThoughtStatusFilter = 'all' | ThoughtStatus;

const route = useRoute();

type CategoryKey = 'all' | 'work' | 'life' | 'study' | 'social' | 'creation' | 'travel';

const statusSelectOptions: Array<{ label: string; value: ThoughtStatusFilter }> = [
  { label: '全部', value: 'all' },
  { label: '待处理', value: 'pending' },
  { label: '进行中', value: 'ongoing' },
  { label: '已完成', value: 'done' },
  { label: '已归档', value: 'archived' },
];

const statusFilter = ref<ThoughtStatusFilter>('pending');

const getThoughtStatusKey = (status: any): ThoughtStatus => {
  const key = String(status ?? '').trim();
  if (key === 'pending' || key === 'ongoing' || key === 'done' || key === 'archived') {
    return key;
  }
  return 'pending';
};

const getThoughtStatusLabel = (status: any): string => {
  const key = getThoughtStatusKey(status);
  if (key === 'pending') return '待处理';
  if (key === 'ongoing') return '进行中';
  if (key === 'done') return '已完成';
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
  travel: {
    title: '旅行',
    themeKey: 'orange',
    icon: '/thought-icons/travel.png',
    accent: '#f97316',
    rgb: '249 115 22',
  },
};

const activeCategoryKey = computed<CategoryKey>(() => {
  const seg = route.path.split('/')[2] ?? 'all';
  const key = seg.trim();
  if (
    key === 'all' ||
    key === 'work' ||
    key === 'life' ||
    key === 'study' ||
    key === 'social' ||
    key === 'creation' ||
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

const showModal = ref(false);
const currentEditId = ref<null | number | string>(null);

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
const isContentEditing = ref(false);

const contentCharCount = computed(() => String(form.content ?? '').trim().length);
const eventCount = computed(() => (form.events ?? []).length);

const formAccent = computed(() => {
  const key = (form.themeKey || 'blue') as ThemeKey;
  return getThemePreset(key);
});

// 计算属性
const modalTitle = computed(() =>
  currentEditId.value === null ? '添加新思考' : '编辑思考',
);

const getThoughtThemeKey = (thought: Thought): ThemeKey => {
  const themeKey = thought?.themeKey as ThemeKey | undefined;
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
  isExtraOpen.value = false;
  isContentEditing.value = false;
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
    isExtraOpen.value = false;
    isContentEditing.value = false;
    showModal.value = true;
  }
};

const closeCardModal = () => {
  showModal.value = false;
  isExtraOpen.value = false;
  isContentEditing.value = false;
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

const saveCard = async () => {
  const subject = form.subject.trim();
  const content = form.content.trim();
  const finalSubject = subject || (content ? getThoughtCardTitle({ id: 0, content } as any) : '');
  if (!finalSubject) {
    message.warning('主题内容不能为空');
    return;
  }
  form.subject = finalSubject;

  if (!form.themeKey) {
    message.warning('类型不能为空');
    return;
  }

  const validEvents = form.events.filter(
    (event) => event.content.trim() !== '',
  );

  // 构造提交数据
  const payload: any = {
    subject: finalSubject,
    topic: finalSubject,
    content,
    themeKey: form.themeKey,
    status: form.status,
    events: validEvents.map((e) => ({ ...e })),
  };

  // 只有在编辑模式下才传 id
  if (currentEditId.value !== null) {
    payload.id = currentEditId.value;
  }

  try {
    if (currentEditId.value === null) {
      await saveThink(toRaw(payload));
    } else {
      await updateThink(toRaw(payload));
    }
    closeCardModal();
    await loadThoughts();
    message.success('保存成功');
  } catch {
    message.error('保存失败');
  }
};

const handleDelete = async (id: number | string) => {
  try {
    await deleteThink({ idList: [id] });
    thoughts.value = thoughts.value.filter((t) => t.id !== id);
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

// 生命周期
const loadThoughts = async () => {
  loading.value = true;
  try {
    const condition: Record<string, any> = {};
    if (activeCategoryThemeKey.value) {
      condition.themeKey = activeCategoryThemeKey.value;
    }
    if (statusFilter.value !== 'all') {
      condition.status = statusFilter.value;
    }
    const res = await queryThink({ page: 1, pageSize: 50, condition });
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
      .toSorted(
        (a: Thought, b: Thought) =>
          new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
      );
  } catch {
    message.error('加载失败');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadThoughts();
});

watch(
  () => activeCategoryThemeKey.value,
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
</script>

<template>
  <div class="think-page">
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

    <GlobalFloatBtn @click="openAddModal" />

    <Modal
      v-model:open="showModal"
      :title="modalTitle"
      :footer="null"
      :mask-closable="false"
      :destroy-on-close="true"
      centered
      @cancel="closeCardModal"
    >
      <Form
        layout="vertical"
        class="modern-form"
        :style="{
          '--thought-accent': formAccent.accent,
          '--thought-accent-rgb': formAccent.rgb,
        }"
      >
        <Form.Item label="主题内容" required>
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
              v-for="item in statusSelectOptions"
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

        <Form.Item label="闪念内容">
          <div v-if="!isContentEditing" class="modal-content-preview">
            <div class="modal-content-preview-text">
              {{ form.content?.trim() ? form.content.trim() : '—' }}
            </div>
            <Button type="link" class="modal-content-toggle" @click="isContentEditing = true">
              展开编辑
            </Button>
          </div>
          <div v-else class="modal-content-editor">
            <Input.TextArea
              v-model:value="form.content"
              :auto-size="{ minRows: 4, maxRows: 10 }"
              placeholder="这一刻的想法..."
              class="content-textarea"
              :bordered="false"
            />
            <Button type="link" class="modal-content-toggle" @click="isContentEditing = false">
              收起编辑
            </Button>
          </div>
        </Form.Item>

        <div class="modal-divider"></div>

        <div class="modal-extra-toggle" @click="isExtraOpen = !isExtraOpen">
          <div class="modal-extra-title">扩展信息</div>
          <div class="modal-extra-meta">
            内容 {{ contentCharCount }}字 · 事件 {{ eventCount }}个
          </div>
          <div class="modal-extra-arrow" :class="{ 'is-open': isExtraOpen }">˅</div>
        </div>

        <div v-if="isExtraOpen" class="modal-extra-body">
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
            <Button type="text" @click="isExtraOpen = !isExtraOpen">更多操作</Button>
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

.think-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
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
  padding-right: 52px;
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
  top: 14px;
  right: 14px;
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
    padding-right: 48px;
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

.modal-content-preview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.modal-content-preview-text {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgb(128 128 128 / 4%);
  font-size: 14px;
  line-height: 1.6;
  color: rgb(0 0 0 / 0.72);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}

.modal-content-editor {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-content-toggle {
  padding: 0;
  height: 32px;
  font-weight: 700;
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
