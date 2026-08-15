import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUuid } from './uuid';

describe('createUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses native randomUUID when available', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    const randomUUID = vi.fn(() => uuid);
    vi.stubGlobal('crypto', { randomUUID });

    expect(createUuid()).toBe(uuid);
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a UUID v4 with getRandomValues on an insecure origin', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });

    const uuid = createUuid();

    expect(uuid).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
