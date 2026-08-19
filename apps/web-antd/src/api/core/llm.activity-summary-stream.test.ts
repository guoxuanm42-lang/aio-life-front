import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateActivitySummaryStreamApi } from './llm';

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'test-token' }),
}));

vi.mock('#/api/request', () => ({ requestClient: {} }));

const request = {
  conversationId: '20',
  idempotencyKey: '123e4567-e89b-12d3-a456-426614174000',
  period: 'week' as const,
};

const streamResponse = (chunks: string[]) => {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { status: 200 },
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateActivitySummaryStreamApi', () => {
  it('parses fragmented progress and done events', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamResponse([
            'event: progress\ndata: {"stage":"COLLECT',
            'ING","label":"正在汇总活动数据","percent":15}\n\n',
            'event: done\ndata: {"conversationId":"20","period":"week",',
            '"userMessage":"指令","content":"复盘","assistantMessageId":"2"}\n\n',
          ]),
        ),
    );
    const onProgress = vi.fn();
    const onDone = vi.fn();
    const onDisconnected = vi.fn();

    await generateActivitySummaryStreamApi(
      request,
      onProgress,
      onDone,
      undefined,
      onDisconnected,
    ).start();

    expect(onProgress).toHaveBeenCalledWith({
      stage: 'COLLECTING',
      label: '正在汇总活动数据',
      percent: 15,
    });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ assistantMessageId: '2', period: 'week' }),
    );
    expect(onDisconnected).not.toHaveBeenCalled();
  });

  it('reports an unexpected connection close without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'event: progress\ndata: {"stage":"GENERATING","label":"AI 正在生成复盘","percent":55}\n\n',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onDisconnected = vi.fn();

    await generateActivitySummaryStreamApi(
      request,
      undefined,
      undefined,
      undefined,
      onDisconnected,
    ).start();

    expect(onDisconnected).toHaveBeenCalledWith('生成进度连接意外中断');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
