import { afterEach, describe, expect, it, vi } from 'vitest';

import { chatWithAiStreamApi } from './ai';

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'test-token' }),
}));

describe('chatWithAiStreamApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads structured token and done events without changing whitespace', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: token\r\ndata: {"content":"  code'),
        );
        controller.enqueue(
          encoder.encode(
            '\\n[DONE] data:"}\r\n\r\nevent: done\r\ndata: {"modelName":"gpt"}\r\n\r\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(body, { status: 200 })),
    );
    const tokens: string[] = [];
    const onDone = vi.fn();

    await chatWithAiStreamApi(
      { message: 'hello' },
      (token) => tokens.push(token),
      onDone,
    ).start();

    expect(tokens).toEqual(['  code\n[DONE] data:']);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('reports an explicit abort as cancellation instead of an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        });
      }),
    );
    const onError = vi.fn();
    const onCancelled = vi.fn();
    const stream = chatWithAiStreamApi(
      { message: 'hello' },
      undefined,
      undefined,
      onError,
      onCancelled,
    );

    const request = stream.start();
    stream.abort();
    await request;

    expect(onCancelled).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });
});
