<script setup lang="ts">
import type { Message } from '#/api/core/message';

import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { usePreferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { message as antMessage } from 'ant-design-vue';

import {
  createMessageApi,
  getMessageListApi,
  markAsReadApi,
} from '#/api/core/message';

import {
  chatWithLLMApi,
  summarizeTimeRecordsApi,
  chatWithLLMStreamApi,
} from '#/api/core/llm';

import { marked } from 'marked';

import { getUserBasicInfoApi } from '#/api/core/user';

import ChatWindow from './components/ChatWindow.vue';
import ConversationList from './components/ConversationList.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const { isMobile } = usePreferences();

const messages = ref<Message[]>([]);
const loading = ref(false);
const activeMenu = ref('my-messages');
const tempConversation = ref<any>(null);

// Menu items
const menuItems = [
  { key: 'my-messages', label: '我的消息', icon: 'ant-design:message-outlined' },
  { key: 'ai-chat', label: 'AI 对话', icon: 'ant-design:robot-outlined' },
];

// AI chat state
const isAIChat = computed(() => activeMenu.value === 'ai-chat');
const aiChatLoading = ref(false);
const aiChatMessages = ref<Message[]>([]);
const aiChatInput = ref('');
const aiChatContext = ref('');
const streamingContent = ref('');
const isStreaming = ref(false);
const summarizeLoading = ref(false);

// Current user ID
const myId = computed(() => {
  const info = userStore.userInfo as any;
  return String(info?.userId || info?.id || '');
});

// Selected conversation user ID
const selectedUserId = computed(() => {
  const id = route.query.userId;
  return id ? String(id) : undefined;
});

// Mark conversation as read
const markConversationAsRead = async (senderId: string) => {
  if (!myId.value) return;
  
  const unreadMessages = messages.value.filter(
    (m) =>
      String(m.senderId) === senderId &&
      String(m.receiverId) === myId.value &&
      !m.isRead
  );

  if (unreadMessages.length > 0) {
    try {
      await Promise.all(unreadMessages.map((msg) => markAsReadApi(msg.id)));
      unreadMessages.forEach(msg => msg.isRead = true);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  }
};

const checkUser = async (userId: string) => {
  const existing = messages.value.some(
    (m) =>
      String(m.senderId) === userId || String(m.receiverId) === userId,
  );

  if (existing) {
    tempConversation.value = null;
    return;
  }

  if (userCache.value.has(userId)) {
    const info = userCache.value.get(userId);
    tempConversation.value = {
      userId,
      username: info?.nickname || `User ${userId}`,
      avatar: info?.avatar,
      lastMessage: '',
      time: new Date().toISOString(),
      unreadCount: 0,
    };
    return;
  }

  try {
    const info = await getUserBasicInfoApi(userId);
    if (info) {
      userCache.value.set(userId, {
        nickname: info.nickname,
        avatar: info.avatar,
      });
      tempConversation.value = {
        userId,
        username: info.nickname || `User ${userId}`,
        avatar: info.avatar,
        lastMessage: '',
        time: new Date().toISOString(),
        unreadCount: 0,
      };
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    antMessage.error('用户不存在');
    router.replace({ query: { ...route.query, userId: undefined } });
    tempConversation.value = null;
  }
};

const fetchMessages = async () => {
  try {
    loading.value = true;
    messages.value = await getMessageListApi();
    if (selectedUserId.value) {
      await markConversationAsRead(selectedUserId.value);
      await checkUser(selectedUserId.value);
    }
  } finally {
    loading.value = false;
  }
};

const userCache = ref(new Map<string, { nickname: string; avatar: string }>());
const fetchingUserIds = new Set<string>();

const conversationCache = new Map<string, any>();

const fetchUserInfo = async (userId: string) => {
  if (userCache.value.has(userId) || fetchingUserIds.has(userId)) {
    return;
  }

  fetchingUserIds.add(userId);
  try {
    const info = await getUserBasicInfoApi(userId);
    const data = {
      nickname: info.nickname || `User ${userId}`,
      avatar: info.avatar || '',
    };
    userCache.value.set(userId, data);
  } catch (e) {
    userCache.value.set(userId, { nickname: `User ${userId}`, avatar: '' });
  } finally {
    fetchingUserIds.delete(userId);
  }
};

const conversations = computed(() => {
  const groups = new Map<string, Message[]>();

  messages.value.forEach((msg) => {
    const otherId = String(msg.senderId) === String(myId.value) ? String(msg.receiverId) : String(msg.senderId);
    if (!groups.has(otherId)) {
      groups.set(otherId, []);
    }
    groups.get(otherId)?.push(msg);
  });

  const list = Array.from(groups.entries()).map(([userId, msgs]) => {
    msgs.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    const lastMsg = msgs[0];
    
    if (!lastMsg) {
      return null;
    }
    
    const unreadCount = msgs.filter((m) => String(m.receiverId) === String(myId.value) && !m.isRead).length;

    const userInfo = userCache.value.get(userId);
    
    const username = userInfo?.nickname || `User ${userId}`;
    const avatar = userInfo?.avatar;
    const lastMessage = lastMsg.content;
    const time = lastMsg.createTime;

    const cached = conversationCache.get(userId);
    if (
      cached &&
      cached.username === username &&
      cached.avatar === avatar &&
      cached.lastMessage === lastMessage &&
      cached.time === time &&
      cached.unreadCount === unreadCount
    ) {
      return cached;
    }

    const newConversation = {
      userId,
      username,
      avatar,
      lastMessage,
      time,
      unreadCount,
    };
    conversationCache.set(userId, newConversation);
    return newConversation;
  }).filter((item) => item !== null);

  if (
    tempConversation.value &&
    !list.some((c) => c?.userId === tempConversation.value.userId)
  ) {
    list.push(tempConversation.value);
  }

  return list.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
  );
});

watch(
  () => conversations.value,
  (newConversations) => {
    newConversations.forEach((c) => {
      if (!userCache.value.has(c.userId)) {
        fetchUserInfo(c.userId);
      }
    });
  },
  { immediate: true, deep: true },
);

const currentChatMessages = computed(() => {
  if (!selectedUserId.value) return [];
  return messages.value
    .filter(
      (m) =>
        (String(m.senderId) === String(myId.value) && String(m.receiverId) === String(selectedUserId.value)) ||
        (String(m.senderId) === String(selectedUserId.value) && String(m.receiverId) === String(myId.value)),
    )
    .sort((a, b) => new Date(a.createTime).getTime() - new Date(b.createTime).getTime());
});

const handleSelectConversation = (userId: string) => {
  router.push({ query: { ...route.query, userId } });
};

const handleBack = () => {
  router.push({ query: { ...route.query, userId: undefined } });
};

watch(
  () => selectedUserId.value,
  async (newId) => {
    if (newId) {
      await markConversationAsRead(newId);
      await checkUser(newId);
    }
  },
);

const handleSendMessage = async (content: string) => {
  if (!selectedUserId.value) return;

  try {
    const newMessages = await createMessageApi({
      receiverId: selectedUserId.value,
      content,
      title: 'Chat Message',
      type: 1,
    });
    
    if (newMessages) {
      if (Array.isArray(newMessages)) {
        messages.value.push(...newMessages);
      } else {
        messages.value.push(newMessages);
      }
      tempConversation.value = null;
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const handleDeleteMessage = (id: string) => {
  messages.value = messages.value.filter((m) => m.id !== id);
};

const aiMessageRef = ref<Message | null>(null);

const handleAISendMessage = async () => {
  if (!aiChatInput.value.trim() || isStreaming.value) return;

  const content = aiChatInput.value.trim();
  aiChatInput.value = '';

  const userMessage: Message = {
    id: Date.now().toString(),
    senderId: myId.value,
    receiverId: 'ai',
    title: 'AI Chat',
    content,
    type: 1,
    isRead: true,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  };
  aiChatMessages.value.push(userMessage);

  aiMessageRef.value = {
    id: (Date.now() + 1).toString(),
    senderId: 'ai',
    receiverId: myId.value,
    title: 'AI Chat',
    content: '',
    type: 1,
    isRead: true,
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  };
  aiChatMessages.value.push(aiMessageRef.value);
  streamingContent.value = '';
  isStreaming.value = true;
  aiChatLoading.value = true;

  try {
    chatWithLLMStreamApi(
      content,
      aiChatContext.value,
      (token) => {
        streamingContent.value += token;
        if (aiMessageRef.value) {
          aiMessageRef.value.content = streamingContent.value;
        }
      },
      () => {
        isStreaming.value = false;
        aiChatLoading.value = false;
        updateContext();
      },
      (error) => {
        console.error('Failed to send message to AI:', error);
        antMessage.error('发送消息失败，请检查大模型配置');
        if (aiMessageRef.value) {
          aiMessageRef.content = error;
        }
        isStreaming.value = false;
        aiChatLoading.value = false;
      }
    ).start();
  } catch (error) {
    console.error('Failed to send message to AI:', error);
    antMessage.error('发送消息失败，请检查大模型配置');
    isStreaming.value = false;
    aiChatLoading.value = false;
  }
};

const updateContext = () => {
  aiChatContext.value = aiChatMessages.value.slice(-10).map(msg => {
    return `${msg.senderId === myId.value ? 'User' : 'AI'}: ${msg.content}`;
  }).join('\n');
};

const handleSummarizeTimeRecords = async (type: 'today' | 'week') => {
  try {
    summarizeLoading.value = true;
    const summary = await summarizeTimeRecordsApi(type);
    
    const summaryMessage: Message = {
      id: Date.now().toString(),
      senderId: 'ai',
      receiverId: myId.value,
      title: 'Time Records Summary',
      content: summary,
      type: 1,
      isRead: true,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };
    aiChatMessages.value.push(summaryMessage);
  } catch (error) {
    console.error('Failed to summarize time records:', error);
    antMessage.error('总结时迹记录失败，请检查大模型配置');
  } finally {
    summarizeLoading.value = false;
  }
};

const renderMarkdown = (content: string) => {
  return marked.parse(content, {
    breaks: true,
    gfm: true,
  }) as string;
};

const chatMessagesContainer = ref<HTMLElement | null>(null);

watch(aiChatMessages, async () => {
  await nextTick();
  if (chatMessagesContainer.value) {
    chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight;
  }
}, { deep: true });

onMounted(() => {
  fetchMessages();
});
</script>

<template>
  <div :class="[isMobile ? 'h-[calc(100vh-48px)] p-0' : 'h-[calc(100vh-100px)] p-4']">
    <div 
      class="flex h-full bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100"
      :class="{'rounded-none border-0': isMobile}"
    >
      <div v-if="!isMobile" class="w-48 bg-gray-50/50 border-r border-gray-100 flex flex-col py-2">
        <div class="px-4 py-3 font-bold text-lg text-gray-800 flex items-center gap-2">
           <span class="i-ant-design:message-filled text-blue-500"></span>
           消息中心
        </div>
        <div class="flex-1 space-y-1 px-2 mt-2">
          <div
            v-for="item in menuItems"
            :key="item.key"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm font-medium"
            :class="
              activeMenu === item.key
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            "
            @click="activeMenu = item.key"
          >
            <span :class="item.icon" class="text-lg"></span>
            {{ item.label }}
          </div>
        </div>
      </div>

      <div 
        v-if="!isMobile || !selectedUserId" 
        class="border-r border-gray-100 flex flex-col bg-white"
        :class="isMobile ? 'flex-1 w-full' : 'w-72'"
      >
        <ConversationList
          :conversations="conversations"
          :selected-user-id="selectedUserId"
          @select="handleSelectConversation"
        />
      </div>

      <div v-if="!isMobile || selectedUserId || isAIChat" class="flex-1 flex flex-col bg-white">
        <div v-if="isAIChat" class="flex-1 flex flex-col">
          <div class="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span class="i-ant-design:robot-outlined text-blue-500 text-lg"></span>
              </div>
              <div>
                <h3 class="font-medium text-gray-800">AI 助手</h3>
                <p class="text-xs text-gray-500">智能对话与时迹分析</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                class="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleSummarizeTimeRecords('today')"
                :disabled="summarizeLoading || isStreaming"
              >
                <span v-if="summarizeLoading" class="ant-spin ant-spin-spinning mr-1"></span>
                总结今日
              </button>
              <button
                class="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="handleSummarizeTimeRecords('week')"
                :disabled="summarizeLoading || isStreaming"
              >
                <span v-if="summarizeLoading" class="ant-spin ant-spin-spinning mr-1"></span>
                总结本周
              </button>
            </div>
          </div>

          <div 
            ref="chatMessagesContainer"
            class="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
            style="max-height: calc(100vh - 200px);"
          >
            <div
              v-for="msg in aiChatMessages"
              :key="msg.id"
              class="flex"
              :class="msg.senderId === myId ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[70%] p-3 rounded-lg"
                :class="msg.senderId === myId ? 'bg-blue-100 text-gray-800' : 'bg-gray-100 text-gray-800'"
              >
                <div 
                  v-if="msg.senderId !== myId"
                  v-html="renderMarkdown(msg.content)"
                  class="prose prose-sm max-w-none"
                ></div>
                <p v-else>{{ msg.content }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ new Date(msg.createTime).toLocaleTimeString() }}</p>
              </div>
            </div>
            <div v-if="aiChatMessages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
              <div class="i-ant-design:robot-outlined text-6xl opacity-20 mb-4"></div>
              <p>开始与 AI 助手对话</p>
              <p class="text-sm mt-2">可以尝试让 AI 总结你的时迹记录</p>
            </div>
          </div>

          <div class="border-t border-gray-100 p-4">
            <div class="flex gap-2">
              <input
                v-model="aiChatInput"
                type="text"
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="输入消息..."
                @keyup.enter="handleAISendMessage"
                :disabled="isStreaming"
              />
              <button
                class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                @click="handleAISendMessage"
                :disabled="aiChatLoading || !aiChatInput.trim() || isStreaming"
              >
                <span v-if="aiChatLoading" class="ant-spin ant-spin-spinning"></span>
                <span v-else>发送</span>
              </button>
            </div>
          </div>
        </div>

        <ChatWindow
          v-else-if="selectedUserId"
          :messages="currentChatMessages"
          :target-id="selectedUserId"
          :target-name="userCache.get(selectedUserId)?.nickname || `User ${selectedUserId}`"
          :my-id="myId"
          :my-avatar="userStore.userInfo?.avatar"
          :loading="loading"
          :is-mobile="isMobile"
          @send="handleSendMessage"
          @delete="handleDeleteMessage"
          @back="handleBack"
        />
        <div v-else class="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/30">
          <div class="i-ant-design:message-outlined text-6xl opacity-20 mb-4"></div>
          <p>选择一个会话开始聊天</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose {
  max-width: none;
}
.prose :deep(p) {
  margin-bottom: 0.75rem;
  margin-top: 0.75rem;
}
.prose :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}
.prose :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}
.prose :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 0.875rem;
  margin-bottom: 0.5rem;
}
.prose :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
.prose :deep(pre) {
  background-color: #1f2937;
  color: #e5e7eb;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.prose :deep(pre code) {
  background-color: transparent;
  padding: 0;
}
.prose :deep(ul) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
.prose :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}
.prose :deep(li) {
  margin: 0.25rem 0;
}
.prose :deep(blockquote) {
  border-left: 4px solid #3b82f6;
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: #4b5563;
  font-style: italic;
}
.prose :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}
.prose :deep(a:hover) {
  color: #1d4ed8;
}
.prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
}
.prose :deep(th), .prose :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5rem;
}
.prose :deep(th) {
  background-color: #f3f4f6;
  font-weight: 600;
}
</style>
