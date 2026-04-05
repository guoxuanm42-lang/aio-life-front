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

const removeEvent = (index: number) => {
  form.events.splice(index, 1);
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
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Date(dateString).toLocaleDateString('zh-CN', options);
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
      <template v-if="thoughts.length === 0">
        <div class="empty-wrap">
          <Empty description="还没有任何思考记录">
            <Button type="primary" @click="openAddModal">
              <template #icon><PlusOutlined /></template>
              添加新思考
            </Button>
          </Empty>
        </div>
      </template>

      <div v-else class="cards-grid">
        <Card
          v-for="thought in thoughts"
          :key="thought.id"
          hoverable
          class="thought-card"
          @click="openEditModal(thought.id)"
        >
          <div class="card-content">{{ thought.content }}</div>
          <div class="card-footer">
            <span class="card-date">{{ formatDate(thought.createTime) }}</span>
            <Tag color="blue" v-if="(thought.events || []).length > 0">事件 {{ (thought.events || []).length }}</Tag>
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

    <Modal v-model:open="showModal" :title="modalTitle" :footer="null" :maskClosable="false" @cancel="closeCardModal">
      <Form layout="vertical">
        <Form.Item label="思考内容" required>
          <Input.TextArea v-model:value="form.content" :rows="4" placeholder="写下你的思考..." />
        </Form.Item>

        <Form.Item label="关联事件">
          <div v-for="event in [...form.events].reverse()" :key="event.id" class="event-item">
            <div class="event-row">
              <Input v-model:value="event.content" placeholder="事件..." />
              <Button type="text" danger @click="removeEventById(event.id)" v-if="form.events.length > 1">
                <template #icon><DeleteOutlined /></template>
              </Button>
            </div>
            <div class="event-time">{{ formatDate(event.create_time) }}</div>
          </div>
          <Button type="dashed" block @click="addEvent">
            <template #icon><PlusOutlined /></template>
            添加事件
          </Button>
        </Form.Item>

        <div class="form-actions" :style="{ justifyContent: currentEditId ? 'space-between' : 'flex-end' }">
          <Popconfirm
            v-if="currentEditId"
            title="确定要删除这条思考吗？"
            ok-text="确定"
            cancel-text="取消"
            @confirm="handleDelete(currentEditId!)"
          >
            <Button danger>
              <template #icon><DeleteOutlined /></template>
              删除
            </Button>
          </Popconfirm>
          <Space>
            <Button @click="closeCardModal">取消</Button>
            <Button type="primary" @click="saveCard">保存</Button>
          </Space>
        </div>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>


.think-page {
  max-width: 1200px;
  padding: 24px;
  margin: 0 auto;
}

.empty-wrap {
  padding: 60px 20px;
  text-align: center;
  background: #fff;
  border: 1px dashed #d9d9d9;
  border-radius: 12px;
}

.cards-grid {
  columns: 1;
  gap: 20px;
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

/* Mobile Adaptation */
@media (max-width: 768px) {
  .think-page {
    padding: 16px;
  }

  .cards-grid {
    columns: 1;
    gap: 16px;
  }

  .thought-card :deep(.ant-card-body) {
    padding: 16px;
  }

  .card-content {
    -webkit-line-clamp: 4;
    font-size: 14px;
  }
}

.thought-card {
  margin-bottom: 20px;
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  transition: all 0.3s ease;
  break-inside: avoid;
}

.thought-card:hover {
  border-color: #e6f4ff;
  box-shadow: 0 12px 24px rgb(0 0 0 / 6%);
  transform: translateY(-4px);
}

.thought-card :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}

.card-content {
  display: -webkit-box;
  flex: 1;
  margin-bottom: 16px;
  overflow: hidden;
  -webkit-line-clamp: 6;
  font-size: 15px;
  line-height: 1.6;
  color: #262626;
  -webkit-box-orient: vertical;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;
}

.card-date {
  font-size: 12px;
  color: #999;
}

.event-item {
  padding: 12px;
  margin-bottom: 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.event-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.event-time {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 隐藏原生 textarea 滚动条但保留功能，使 UI 更简洁 */
textarea::-webkit-scrollbar {
  width: 6px;
}

textarea::-webkit-scrollbar-thumb {
  background: rgb(156 163 175 / 50%);
  border-radius: 4px;
}

textarea:hover::-webkit-scrollbar-thumb {
  background: rgb(156 163 175 / 80%);
}
</style>
