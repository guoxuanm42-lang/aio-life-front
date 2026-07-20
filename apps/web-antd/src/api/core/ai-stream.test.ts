import { describe, expect, it } from 'vitest';

import { createServerSentEventParser } from './ai-stream';

describe('createServerSentEventParser', () => {
  it('parses fragmented CRLF events and multiple events in one chunk', () => {
    const events: Array<{ data: string; event: string }> = [];
    const parser = createServerSentEventParser((event) => events.push(event));

    parser.feed('event: token\r\ndata: {"content":"你');
    parser.feed(
      '好😊 data: [DONE]"}\r\n\r\nevent: done\ndata: {"modelName":"gpt"}\n\n',
    );

    expect(events).toEqual([
      { event: 'token', data: '{"content":"你好😊 data: [DONE]"}' },
      { event: 'done', data: '{"modelName":"gpt"}' },
    ]);
  });

  it('joins multiline data without trimming whitespace', () => {
    const events: Array<{ data: string; event: string }> = [];
    const parser = createServerSentEventParser((event) => events.push(event));

    parser.feed('event: token\ndata:   first line\ndata: second line  \n\n');

    expect(events).toEqual([
      { event: 'token', data: '  first line\nsecond line  ' },
    ]);
  });

  it('flushes a final event without a trailing separator', () => {
    const events: Array<{ data: string; event: string }> = [];
    const parser = createServerSentEventParser((event) => events.push(event));

    parser.feed('event: error\ndata: {"message":"failed"}');
    parser.end();

    expect(events).toEqual([{ event: 'error', data: '{"message":"failed"}' }]);
  });
});
