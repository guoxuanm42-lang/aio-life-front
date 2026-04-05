<script setup lang="ts">
import { computed, onMounted, reactive, ref, toRaw } from 'vue';
import { query as queryThink, save as saveThink, update as updateThink, deleteData as deleteThink } from '#/api/core/think';
import { Button, Card, Modal, Input, Form, Empty, Space, message, Tag, Popconfirm, Spin, FloatButton } from 'ant-design-vue';
import { PlusOutlined, DeleteOutlined, VerticalAlignTopOutlined } from '@ant-design/icons-vue';
import GlobalFloatBtn from '#/components/global-float-btn/index.vue';

interface Event {
  id: number;
  content: string;
  create_time: string;
}

interface Thought {
  id: number;
  content: string;
  events: Event[];
  likes: number;
  createTime: string;
}

const thoughts = ref<Thought[]>([]);
const loading = ref(false);

const showModal = ref(false);
const currentEditId = ref<null | number>(null);

const form = reactive({
  content: '',
  events: [
    {
      id: 1,
      content: '',
      create_time: new Date().toISOString(),
    },
  ],
});

// 计算属性
const modalTitle = computed(() =>
  currentEditId.value === null ? '添加新思考' : '编辑思考',
);

// 方法
const openAddModal = () => {
  form.content = '';
  form.events = [
    {
      id: 1,
      content: '',
      create_time: new Date().toISOString(),
    },
  ];
  currentEditId.value = null;
  showModal.value = true;
};

const openEditModal = (id: number) => {
  const thought = thoughts.value.find((t) => t.id === id);
  if (thought) {
    form.content = thought.content;
    const evs = Array.isArray(thought.events) ? thought.events : [];
    form.events =
      evs.length > 0
        ? evs.map((e) => ({
            ...e,
            create_time: (e as any)?.create_time ?? (e as any)?.createTime ?? new Date().toISOString(),
          }))
        : [
            {
              id: 1,
              content: '',
              create_time: new Date().toISOString(),
            },
          ];
    currentEditId.value = id;
    showModal.value = true;
  }
};

const closeCardModal = () => {
  showModal.value = false;
};

const addEvent = () => {
  const newEventId =
    form.events.length > 0 ? Math.max(...form.events.map((e) => e.id)) + 1 : 1;
  form.events.push({
    id: newEventId,
    content: '',
    create_time: new Date().toISOString(),
  });
};

const removeEventById = (id: number) => {
  const idx = form.events.findIndex((e) => e.id === id);
  if (idx !== -1) form.events.splice(idx, 1);
};

const saveCard = async () => {
  if (!form.content.trim()) {
    message.warning('思考内容不能为空');
    return;
  }

  const validEvents = form.events.filter((event) => event.content.trim() !== '');

  const payload = {
    id: currentEditId.value,
    content: form.content.trim(),
    events: validEvents.map((e) => ({ ...e })),
  };

  try {
    const saved =
      currentEditId.value === null
        ? await saveThink(toRaw(payload))
        : await updateThink(toRaw(payload));

    const normalized = {
      ...saved,
      content: saved?.content ?? saved?.text ?? saved?.title ?? saved?.summary ?? form.content.trim(),
      events: Array.isArray(saved?.events)
        ? (saved as any).events.map((e: any) => ({
            ...e,
            create_time: e?.create_time ?? e?.createTime ?? new Date().toISOString(),
          }))
        : validEvents.map((e) => ({
            ...e,
            create_time: e?.create_time ?? new Date().toISOString(),
          })),
      date: saved?.date ?? new Date().toISOString(),
      createTime: saved?.createTime ?? saved?.create_time ?? new Date().toISOString(),
    };

    if (currentEditId.value === null) {
      thoughts.value.unshift(normalized);
    } else {
      const idx = thoughts.value.findIndex((t) => t.id === currentEditId.value);
      if (idx !== -1) thoughts.value[idx] = normalized;
    }

    closeCardModal();
    message.success('保存成功');
  } catch (e) {
    message.error('保存失败');
  }
};

const handleDelete = async (id: number) => {
  try {
    await deleteThink({ idList: [id] });
    thoughts.value = thoughts.value.filter((t) => t.id !== id);
    message.success('删除成功');
    closeCardModal();
  } catch (e) {
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
    const res = await queryThink({ page: 1, pageSize: 50, condition: {} });
    const list = (res && (res.items ?? res)) || [];
    thoughts.value = list.map((t: any) => ({
      ...t,
      content: t?.content ?? t?.text ?? t?.title ?? t?.summary ?? '',
      events: Array.isArray(t?.events)
        ? t.events.map((e: any) => ({
            ...e,
            create_time: e?.create_time ?? e?.createTime ?? new Date().toISOString(),
          }))
        : [],
      date: t?.date ?? new Date().toISOString(),
      createTime: t?.createTime ?? t?.create_time ?? new Date().toISOString(),
    })).sort((a: Thought, b: Thought) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
  } catch (error) {
    message.error('加载失败');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadThoughts();
});
</script>

<template>
  <div class="think-page">
    <Spin :spinning="loading">
      <template v-if="thoughts.length === 0 && !loading">
        <div class="empty-wrap">
          <Empty description="还没有任何思考记录，点击右下角或下方按钮添加">
            <Button type="primary" shape="round" size="large" @click="openAddModal">
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
          @click="openEditModal(thought.id)"
        >
          <div class="card-content">{{ thought.content }}</div>
          <div class="card-footer">
            <span class="card-date">{{ formatDate(thought.createTime) }}</span>
            <div class="event-badge" v-if="(thought.events || []).length > 0">
              {{ (thought.events || []).length }}
            </div>
          </div>
        </Card>
      </div>
    </Spin>

    <GlobalFloatBtn @click="openAddModal" />

    <FloatButton.BackTop :visibility-height="400" class="global-backtop-btn">
      <template #icon>
        <VerticalAlignTopOutlined />
      </template>
    </FloatButton.BackTop>

    <Modal 
      v-model:open="showModal" 
      :title="modalTitle" 
      :footer="null" 
      :maskClosable="false" 
      :destroyOnClose="true"
      centered
      @cancel="closeCardModal"
    >
      <Form layout="vertical" class="modern-form">
        <Form.Item required>
          <Input.TextArea 
            v-model:value="form.content" 
            :auto-size="{ minRows: 4, maxRows: 12 }" 
            placeholder="这一刻的想法..." 
            class="content-textarea"
            :bordered="false"
          />
        </Form.Item>

        <Form.Item>
          <div class="events-section">
            <div class="events-header">
              <span class="events-title">关联事件流</span>
            </div>
            <div v-for="event in [...form.events].reverse()" :key="event.id" class="event-item">
              <div class="event-row">
                <Input v-model:value="event.content" placeholder="记录相关事件..." :bordered="false" class="event-input" />
                <Button type="text" danger shape="circle" @click="removeEventById(event.id)" v-if="form.events.length > 1">
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
        </Form.Item>

        <div class="form-actions" :style="{ justifyContent: currentEditId ? 'space-between' : 'flex-end' }">
          <Popconfirm
            v-if="currentEditId"
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
          <Space>
            <Button @click="closeCardModal" shape="round">取消</Button>
            <Button type="primary" @click="saveCard" shape="round">保存</Button>
          </Space>
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

.empty-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 60px 20px;
  background: transparent;
}

.cards-grid {
  columns: 1;
  gap: 24px;
}

@media (min-width: 640px) {
  .cards-grid {
    columns: 2;
  }
}

@media (min-width: 1024px) {
  .cards-grid {
    columns: 3;
  }
}

@media (min-width: 1280px) {
  .cards-grid {
    columns: 4;
  }
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .think-page {
    padding: 16px;
  }

  .cards-grid {
    gap: 16px;
  }

  .thought-card :deep(.ant-card-body) {
    padding: 20px;
  }
}

.thought-card {
  margin-bottom: 24px;
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  break-inside: avoid;
  overflow: hidden;
  /* 使用透明度颜色适应夜间模式 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.thought-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.thought-card :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px;
}

.card-content {
  display: -webkit-box;
  flex: 1;
  margin-bottom: 20px;
  overflow: hidden;
  font-size: 15px;
  line-height: 1.7;
  -webkit-line-clamp: 10;
  -webkit-box-orient: vertical;
  word-break: break-word;
  white-space: pre-wrap;
  opacity: 0.85; /* 文字颜色自适应 */
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
}

.card-date {
  font-size: 13px;
  opacity: 0.45;
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
}

/* Modal 内部样式 */
.modern-form .content-textarea {
  padding: 12px 16px;
  font-size: 16px;
  line-height: 1.6;
  background: rgba(128, 128, 128, 0.04);
  border-radius: 12px;
  resize: none;
}

.modern-form .content-textarea:focus {
  background: rgba(128, 128, 128, 0.08);
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
  background: rgba(128, 128, 128, 0.04);
  border-radius: 12px;
  transition: background 0.3s;
}

.event-item:hover {
  background: rgba(128, 128, 128, 0.08);
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 隐藏原生 textarea 滚动条但保留功能 */
textarea::-webkit-scrollbar {
  width: 4px;
}

textarea::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.2);
  border-radius: 4px;
}

textarea:hover::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
}
</style>
