import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { stash, pop, TTL_MS } from '../../src/lib/trash.js';

describe('trash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the stashed payload exactly once', () => {
    const token = stash({ name: 'test' });
    expect(pop(token)).toEqual({ name: 'test' });
    expect(pop(token)).toBeNull();
  });

  it('returns null for an unknown token', () => {
    expect(pop('does-not-exist')).toBeNull();
  });

  it('calls onExpire only if the entry was never popped', () => {
    const onExpire = vi.fn();
    stash({ name: 'expires' }, onExpire);

    vi.advanceTimersByTime(TTL_MS + 1);

    expect(onExpire).toHaveBeenCalledOnce();
    expect(onExpire).toHaveBeenCalledWith({ name: 'expires' });
  });

  it('does not call onExpire once the entry has been popped', () => {
    const onExpire = vi.fn();
    const token = stash({ name: 'popped' }, onExpire);

    pop(token);
    vi.advanceTimersByTime(TTL_MS + 1);

    expect(onExpire).not.toHaveBeenCalled();
  });

  it('cannot be popped once expired', () => {
    const token = stash({ name: 'gone' });
    vi.advanceTimersByTime(TTL_MS + 1);
    expect(pop(token)).toBeNull();
  });
});
