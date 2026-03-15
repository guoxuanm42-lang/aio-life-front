import { requestClient } from '#/api/request';
import { useAccessStore } from '@vben/stores';

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

export async function chatWithLLMApi(prompt: string, context?: string) {
  return requestClient.post<string>('/llm/chat', { prompt, context });
}

export async function summarizeTimeRecordsApi(type: 'today' | 'week') {
  return requestClient.post<string>('/llm/summarize/time-records', { type });
}

export function chatWithLLMStreamApi(
  prompt: string,
  context?: string,
  onData?: (token: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void
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
        body: JSON.stringify({ prompt, context }),
      }).then(async (response) => {
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
                const cleanBeforeDone = beforeDone.replace(/data:/g, '').trim();
                if (cleanBeforeDone) {
                  onData?.(cleanBeforeDone);
                }
                onDone?.();
                return;
              }
              
              if (errorIndex !== -1) {
                const beforeError = buffer.slice(0, errorIndex);
                const cleanBeforeError = beforeError.replace(/data:/g, '').trim();
                if (cleanBeforeError) {
                  onData?.(cleanBeforeError);
                }
                const errorMsg = buffer.slice(errorIndex + 8);
                onError?.(errorMsg.replace(/data:/g, '').trim());
                return;
              }
              
              const nextDataIndex = buffer.indexOf('data:', 5);
              
              if (nextDataIndex === -1) {
                break;
              }
              
              const chunk = buffer.slice(0, nextDataIndex);
              const cleanChunk = chunk.replace(/data:/g, '').trim();
              
              if (cleanChunk) {
                onData?.(cleanChunk);
              }
              
              buffer = buffer.slice(nextDataIndex);
            }
          }
        }
        
        if (buffer.trim()) {
          const cleanBuffer = buffer.replace(/data:/g, '').trim();
          if (cleanBuffer && cleanBuffer !== '[DONE]' && !cleanBuffer.startsWith('[ERROR] ')) {
            onData?.(cleanBuffer);
          }
        }
        
        onDone?.();
      }).catch((err) => {
        onError?.(err.message);
      });
    },
  };
}
