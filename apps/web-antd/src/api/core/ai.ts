import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

export interface AiAgentConfig {
  id?: number;
  userId?: number;
  code: string;
  name: string;
  description?: string;
  modelKeyId?: string;
  systemPrompt?: string;
  enabledTools?: string;
  memoryScope?: string;
  maxContextMessages?: number;
  maxMemoryItems?: number;
  temperature?: number;
  enabled?: boolean;
  userConfigured?: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface AiAgentConfigSaveRequest {
  name?: string;
  description?: string;
  modelKeyId?: string;
  systemPrompt?: string;
  enabledTools?: string;
  memoryScope?: string;
  maxContextMessages?: number;
  maxMemoryItems?: number;
  temperature?: number;
}

export interface AiChatRequest {
  agentCode?: string;
  conversationId?: number | string;
  message: string;
  context?: string;
}

export interface AiChatResponse {
  agentCode?: string;
  conversationId?: number | string;
  content: string;
  modelName?: string;
  agentName?: string;
  systemPromptApplied?: boolean;
}

export interface AiMemory {
  id?: number;
  userId?: number;
  agentCode: string;
  memoryType: string;
  memoryKey: string;
  memoryValue: string;
  sourceType?: string;
  sourceId?: string;
  importance?: number;
  enabled?: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface AiMemorySaveRequest {
  agentCode?: string;
  memoryType?: string;
  memoryKey?: string;
  memoryValue?: string;
  sourceType?: string;
  sourceId?: string;
  importance?: number;
}

export interface AiMemoryQuery {
  agentCode?: string;
  memoryType?: string;
}

export async function getAiAgentsApi() {
  return requestClient.get<AiAgentConfig[]>('/ai/agents');
}

export async function getAiAgentApi(code: string) {
  return requestClient.get<AiAgentConfig>(`/ai/agents/${code}`);
}

export async function saveAiAgentApi(
  code: string,
  data: AiAgentConfigSaveRequest,
) {
  return requestClient.post<AiAgentConfig>(`/ai/agents/${code}`, data);
}

export async function updateAiAgentStatusApi(
  code: string,
  enabled: boolean,
) {
  return requestClient.put<AiAgentConfig>(`/ai/agents/${code}/status`, {
    enabled,
  });
}

export async function chatWithAiApi(data: AiChatRequest) {
  return requestClient.post<AiChatResponse>('/ai/chat', data);
}

export async function getAiMemoriesApi(params?: AiMemoryQuery) {
  return requestClient.get<AiMemory[]>('/ai/memories', { params });
}

export async function getAiMemoryApi(id: number | string) {
  return requestClient.get<AiMemory>(`/ai/memories/${id}`);
}

export async function saveAiMemoryApi(data: AiMemorySaveRequest) {
  return requestClient.post<AiMemory>('/ai/memories', data);
}

export async function updateAiMemoryApi(
  id: number | string,
  data: AiMemorySaveRequest,
) {
  return requestClient.put<AiMemory>(`/ai/memories/${id}`, data);
}

export async function updateAiMemoryStatusApi(
  id: number | string,
  enabled: boolean,
) {
  return requestClient.put<AiMemory>(`/ai/memories/${id}/status`, {
    enabled,
  });
}

export function chatWithAiStreamApi(
  data: AiChatRequest,
  onData?: (token: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void,
) {
  return {
    start: () => {
      const accessStore = useAccessStore();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (accessStore.accessToken) {
        headers.Authorization = `Bearer ${accessStore.accessToken}`;
      }

      fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) {
            throw new Error('No reader available');
          }

          let done = false;
          let buffer = '';

          while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value) {
              buffer += decoder.decode(value, { stream: true });

              while (true) {
                const doneIndex = buffer.indexOf('[DONE]');
                const errorIndex = buffer.indexOf('[ERROR] ');

                if (doneIndex !== -1) {
                  const beforeDone = buffer.slice(0, doneIndex);
                  const cleanBeforeDone = beforeDone
                    .replaceAll('data:', '')
                    .trim();
                  if (cleanBeforeDone) {
                    onData?.(cleanBeforeDone);
                  }
                  onDone?.();
                  return;
                }

                if (errorIndex !== -1) {
                  const beforeError = buffer.slice(0, errorIndex);
                  const cleanBeforeError = beforeError
                    .replaceAll('data:', '')
                    .trim();
                  if (cleanBeforeError) {
                    onData?.(cleanBeforeError);
                  }
                  const errorMsg = buffer.slice(errorIndex + 8);
                  onError?.(errorMsg.replaceAll('data:', '').trim());
                  return;
                }

                const nextDataIndex = buffer.indexOf('data:', 5);
                if (nextDataIndex === -1) {
                  break;
                }

                const chunk = buffer.slice(0, nextDataIndex);
                const cleanChunk = chunk.replaceAll('data:', '').trim();
                if (cleanChunk) {
                  onData?.(cleanChunk);
                }

                buffer = buffer.slice(nextDataIndex);
              }
            }
          }

          if (buffer.trim()) {
            const cleanBuffer = buffer.replaceAll('data:', '').trim();
            if (
              cleanBuffer &&
              cleanBuffer !== '[DONE]' &&
              !cleanBuffer.startsWith('[ERROR] ')
            ) {
              onData?.(cleanBuffer);
            }
          }

          onDone?.();
        })
        .catch((error) => {
          onError?.(error.message);
        });
    },
  };
}
