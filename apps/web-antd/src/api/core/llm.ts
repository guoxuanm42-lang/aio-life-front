import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';

import { createServerSentEventParser } from './ai-stream';

export interface LLMKey {
  id: string;
  userId: number;
  modelName: string;
  apiKey: string;
  baseUrl: string;
  isDefault: number;
  createTime: string;
  updateTime: string;
}

export interface ChatSession {
  id: string;
  userId: number;
  title: string;
  agentCode?: string;
  createTime: string;
  updateTime: string;
}

export interface ChatMessage {
  id: string;
  userId: number;
  conversationId?: string;
  role: 'assistant' | 'user';
  content: string;
  modelName: string;
  sourceType?: string;
  idempotencyKey?: string;
  activitySummary?: ActivitySummaryContext;
  createTime: string;
}

export async function getLLMKeyListApi() {
  return requestClient.get<LLMKey[]>('/llm/key/list');
}

export async function getDefaultLLMKeyApi() {
  return requestClient.get<LLMKey>('/llm/key/default');
}

export async function saveLLMKeyApi(data: Partial<LLMKey>) {
  return requestClient.post('/llm/key', data);
}

export async function updateLLMKeyApi(data: Partial<LLMKey>) {
  return requestClient.put('/llm/key', data);
}

export async function deleteLLMKeyApi(id: string) {
  return requestClient.delete(`/llm/key/${id}`);
}

export async function setDefaultLLMKeyApi(id: string) {
  return requestClient.put(`/llm/key/default/${id}`);
}

export async function chatWithLLMApi(
  prompt: string,
  context?: string,
  conversationId?: string,
) {
  return requestClient.post<string>('/llm/chat', {
    prompt,
    context,
    conversationId,
  });
}

export type ActivitySummaryPeriod = 'month' | 'week' | 'year';

export interface ActivitySummaryCountItem {
  key?: string;
  name: string;
  count: number;
}

export interface ActivitySummaryContext {
  period: ActivitySummaryPeriod;
  startTime: string;
  endTime: string;
  timeRecord?: {
    categoryDurations: Array<{
      categoryId?: string;
      categoryName: string;
      durationMinutes: number;
      percentage: number;
    }>;
    mainActivities: Array<{
      categoryName: string;
      date: string;
      durationMinutes: number;
      title: string;
    }>;
    recordCount: number;
    totalMinutes: number;
  };
  thought?: {
    newCount: number;
    themeDistribution: ActivitySummaryCountItem[];
    titles: string[];
    typeDistribution: ActivitySummaryCountItem[];
  };
  food?: { dishNames: string[]; newCount: number };
  todo?: { contents: string[]; newCount: number };
  problem?: {
    categoryDistribution: ActivitySummaryCountItem[];
    difficultyDistribution: ActivitySummaryCountItem[];
    newCount: number;
    titles: string[];
  };
  note?: { newCount: number; titles: string[] };
  album?: { folderNames: string[]; newFolderCount: number };
  article?: {
    categoryDistribution: ActivitySummaryCountItem[];
    newCount: number;
    newTitles: string[];
    updatedCount: number;
    updatedTitles: string[];
  };
  mcp?: {
    averageDurationMs: number;
    failedCalls: number;
    successCalls: number;
    toolRanking: Array<{
      averageDurationMs: number;
      callCount: number;
      failedCount: number;
      successCount: number;
      toolName: string;
    }>;
    totalCalls: number;
  };
}

export interface ActivitySummaryGenerateRequest {
  period: ActivitySummaryPeriod;
  conversationId: string;
  idempotencyKey: string;
}

export interface ActivitySummaryGenerateResponse {
  conversationId: string;
  userMessageId?: string;
  assistantMessageId?: string;
  period: ActivitySummaryPeriod;
  userMessage: string;
  content: string;
  activitySummary?: ActivitySummaryContext;
  modelName?: string;
  agentCode?: string;
  agentName?: string;
}

export type ActivitySummaryProgressStage =
  | 'COLLECTING'
  | 'COMPLETED'
  | 'GENERATING'
  | 'PREPARING'
  | 'SAVING';

export interface ActivitySummaryProgressEvent {
  label: string;
  percent: number;
  stage: ActivitySummaryProgressStage;
}

export interface ActivitySummaryStreamError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ActivitySummaryStreamController {
  abort: () => void;
  start: () => Promise<void>;
}

export async function generateActivitySummaryApi(
  data: ActivitySummaryGenerateRequest,
) {
  return requestClient.post<ActivitySummaryGenerateResponse>(
    '/ai/activity-summary/generate',
    data,
  );
}

export function generateActivitySummaryStreamApi(
  data: ActivitySummaryGenerateRequest,
  onProgress?: (progress: ActivitySummaryProgressEvent) => void,
  onDone?: (response: ActivitySummaryGenerateResponse) => void,
  onError?: (error: ActivitySummaryStreamError) => void,
  onDisconnected?: (message: string) => void,
  onCancelled?: () => void,
): ActivitySummaryStreamController {
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
        const response = await fetch(
          '/api/ai/activity-summary/generate/stream',
          {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal: abortController.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`活动报告连接失败（${response.status}）`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('活动报告进度响应不可用');

        const decoder = new TextDecoder();
        let terminalEventReceived = false;
        const parser = createServerSentEventParser(
          ({ event, data: payload }) => {
            switch (event) {
              case 'done': {
                terminalEventReceived = true;
                onDone?.(
                  JSON.parse(payload) as ActivitySummaryGenerateResponse,
                );

                break;
              }
              case 'error': {
                terminalEventReceived = true;
                onError?.(JSON.parse(payload) as ActivitySummaryStreamError);

                break;
              }
              case 'progress': {
                onProgress?.(
                  JSON.parse(payload) as ActivitySummaryProgressEvent,
                );

                break;
              }
              // No default
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
          throw new Error('生成进度连接意外中断');
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          onCancelled?.();
          return;
        }
        onDisconnected?.(
          error instanceof Error ? error.message : '生成进度连接意外中断',
        );
      }
    },
  };
}

export async function getChatSessionsApi() {
  return requestClient.get<ChatSession[]>('/llm/sessions');
}

export async function createChatSessionApi(title: string, agentCode?: string) {
  return requestClient.post<ChatSession>('/llm/sessions', { title, agentCode });
}

export async function updateChatSessionApi(id: string, title: string) {
  return requestClient.put(`/llm/sessions/${id}`, { title });
}

export async function deleteChatSessionApi(id: string) {
  return requestClient.delete(`/llm/sessions/${id}`);
}

export async function getChatHistoryApi(conversationId?: string) {
  return requestClient.get<ChatMessage[]>('/llm/chat/history', {
    params: { conversationId },
  });
}

export async function clearChatHistoryApi(conversationId?: string) {
  return requestClient.delete('/llm/chat/history', {
    params: { conversationId },
  });
}

export function chatWithLLMStreamApi(
  prompt: string,
  context?: string,
  conversationId?: string,
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

      fetch('/api/llm/chat/stream', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, context, conversationId }),
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
