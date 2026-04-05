<script setup lang="ts">
import type { ChatSession } from '#/api/core/llm';
import { formatDate } from '@vben/utils';
import { List, ListItem, ListItemMeta, TypographyText, Button, Popconfirm, Input, Modal as AModal } from 'ant-design-vue';
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  sessions: ChatSession[];
  selectedConversationId?: string;
}>();

const emit = defineEmits<{
  (e: 'select', conversationId: string): void;
  (e: 'create'): void;
  (e: 'delete', conversationId: string): void;
  (e: 'update-title', conversationId: string, title: string): void;
}>();

const editingId = ref<string | null>(null);
const editingTitle = ref('');

// Context Menu
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const selectedSessionForMenu = ref<ChatSession | null>(null);
const deleteModalVisible = ref(false);

const handleContextMenu = (e: MouseEvent, session: ChatSession) => {
  e.preventDefault();
  selectedSessionForMenu.value = session;
  contextMenuPosition.value = { x: e.clientX, y: e.clientY };
  contextMenuVisible.value = true;
};

const closeContextMenu = () => {
  contextMenuVisible.value = false;
};

const openDeleteConfirm = () => {
  closeContextMenu();
  deleteModalVisible.value = true;
};

const handleRename = () => {
  if (selectedSessionForMenu.value) {
    startEdit(selectedSessionForMenu.value);
  }
  closeContextMenu();
};

const handleDeleteSession = () => {
  if (selectedSessionForMenu.value) {
    emit('delete', selectedSessionForMenu.value.id);
    deleteModalVisible.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu);
});

const handleSelect = (conversationId: string) => {
  if (editingId.value) return;
  emit('select', conversationId);
};

const startEdit = (session: ChatSession) => {
  editingId.value = session.id;
  editingTitle.value = session.title;
};

const saveEdit = (conversationId: string) => {
  if (editingTitle.value.trim()) {
    emit('update-title', conversationId, editingTitle.value.trim());
  }
  editingId.value = null;
};

const cancelEdit = () => {
  editingId.value = null;
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="p-4 border-b border-gray-100/60 flex justify-between items-center">
      <span class="font-medium text-lg text-gray-800">AI 会话</span>
      <Button type="primary" size="small" @click="emit('create')">
        <template #icon><span class="i-ant-design:plus-outlined"></span></template>
        新对话
      </Button>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <List item-layout="horizontal" :data-source="sessions" class="session-list">
        <template #renderItem="{ item }">
          <ListItem
            :id="`session-${item.id}`"
            class="cursor-pointer hover:bg-gray-50/80 transition-all px-4 !py-3 group"
            :class="{ 'bg-blue-50/50': selectedConversationId === item.id }"
            @click="handleSelect(item.id)"
            @contextmenu="handleContextMenu($event, item)"
          >
            <ListItemMeta>
              <template #title>
                <div class="flex justify-between items-center">
                  <div v-if="editingId === item.id" class="flex-1 flex gap-1 mr-2" @click.stop>
                    <Input
                      v-model:value="editingTitle"
                      size="small"
                      @keyup.enter="saveEdit(item.id)"
                      @blur="saveEdit(item.id)"
                      auto-focus
                    />
                  </div>
                  <span v-else class="font-medium truncate flex-1 mr-2 text-gray-700">{{ item.title || '新对话' }}</span>
                  <span class="text-[10px] text-gray-400 whitespace-nowrap opacity-80">{{ formatDate(item.updateTime, 'MM-DD HH:mm') }}</span>
                </div>
              </template>
              <template #description>
                <div class="flex justify-end items-center mt-0.5 min-h-[16px]">
                  <div class="hidden group-hover:flex gap-3" @click.stop>
                    <span
                      class="i-ant-design:edit-outlined text-gray-400 hover:text-blue-500 transition-colors cursor-pointer text-sm"
                      @click="startEdit(item)"
                    ></span>
                    <Popconfirm
                      title="确定删除此会话吗？"
                      @confirm="emit('delete', item.id)"
                    >
                      <span class="i-ant-design:delete-outlined text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-sm"></span>
                    </Popconfirm>
                  </div>
                </div>
              </template>
            </ListItemMeta>
          </ListItem>
        </template>
      </List>
      <div v-if="sessions.length === 0" class="flex flex-col items-center justify-center py-10 text-gray-400/80">
        <p class="text-xs">暂无会话历史</p>
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
        @click.stop
      >
        <div
          class="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 flex items-center gap-2"
          @click="handleRename"
        >
          <span class="i-ant-design:edit-outlined"></span>
          重命名
        </div>
        <div
          class="px-4 py-2 text-sm text-red-500 cursor-pointer hover:bg-red-50 flex items-center gap-2"
          @click="openDeleteConfirm"
        >
          <span class="i-ant-design:delete-outlined"></span>
          删除会话
        </div>
      </div>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <a-modal
      v-model:open="deleteModalVisible"
      title="确认删除"
      @ok="handleDeleteSession"
    >
      <p>确定要删除此会话吗？这将删除所有聊天记录且无法恢复。</p>
    </a-modal>
  </div>
</template>

<style scoped>
:deep(.ant-list-item-meta-title) {
  margin-bottom: 0 !important;
}

:deep(.ant-list-item-meta-description) {
  line-height: 1;
}

/* 减轻列表项边框颜色 */
:deep(.ant-list-split .ant-list-item) {
  border-block-end: 1px solid rgb(0 0 0 / 3%) !important;
  transition: all 0.2s ease;
}

:deep(.dark .ant-list-split .ant-list-item) {
  border-block-end: 1px solid rgb(255 255 255 / 5%) !important;
}

/* 选中项的边框优化 */
:deep(.ant-list-item.bg-blue-50\/50) {
  padding-left: 14px !important;
  border-left: 2px solid #3b82f6;
}

:deep(.dark .ant-list-item.bg-blue-50\/50) {
  background-color: rgb(59 130 246 / 10%) !important;
}

/* 隐藏最后一个元素的边框 */
:deep(.ant-list-split .ant-list-item:last-child) {
  border-block-end: none !important;
}

/* 自定义滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgb(0 0 0 / 5%);
  border-radius: 10px;
}

:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 10%);
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgb(0 0 0 / 10%);
}

:deep(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 20%);
}
</style>
