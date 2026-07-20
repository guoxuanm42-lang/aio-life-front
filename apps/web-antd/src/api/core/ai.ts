import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { createServerSentEventParser } from './ai-stream';

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

export interface AiStreamController {
  abort: () => void;
  start: () => Promise<void>;
}

interface AiTokenEvent {
  content: string;
}

interface AiErrorEvent {
  code: string;
  message: string;
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

export async function updateAiAgentStatusApi(code: string, enabled: boolean) {
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
  onCancelled?: () => void,
): AiStreamController {
  const abortController = new AbortController();

  return {
    abort: () => abortController.abort(),
    start: async () => {
      const accessStore = useAccessStore();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (accessStore.accessToken) {
        headers.Authorization = `Bearer ${accessStore.accessToken}`;
      }

      try {
        const response = await fetch('/api/ai/chat/stream', {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `AI stream request failed with status ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('AI stream response body is unavailable');
        }

        const decoder = new TextDecoder();
        let terminalEventReceived = false;
        const parser = createServerSentEventParser(
          ({ event, data: eventData }) => {
            switch (event) {
              case 'done': {
                terminalEventReceived = true;
                onDone?.();
                break;
              }
              case 'error': {
                terminalEventReceived = true;
                const payload = JSON.parse(eventData) as AiErrorEvent;
                onError?.(payload.message || 'AI 生成失败，请稍后重试');
                break;
              }
              case 'token': {
                const payload = JSON.parse(eventData) as AiTokenEvent;
                if (typeof payload.content !== 'string') {
                  throw new TypeError('Invalid AI token event');
                }
                onData?.(payload.content);
                break;
              }
            }
          },
        );

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parser.feed(decoder.decode(value, { stream: true }));
          if (terminalEventReceived) break;
        }

        parser.feed(decoder.decode());
        parser.end();

        if (terminalEventReceived) {
          await reader.cancel();
        } else {
          throw new Error('AI stream connection closed unexpectedly');
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          onCancelled?.();
          return;
        }
        onError?.(error instanceof Error ? error.message : '未知流式请求错误');
      }
    },
  };
}
