import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/providers/retry.js';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, [10, 10])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate limit'), { status: 429 }))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, [1])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 503', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, [1])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network ECONNRESET', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, [1])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 401 or 400', async () => {
    const fn401 = vi.fn().mockRejectedValue(Object.assign(new Error('unauthorised'), { status: 401 }));
    await expect(withRetry(fn401, [1, 1])).rejects.toThrow(/unauthorised/);
    expect(fn401).toHaveBeenCalledTimes(1);

    const fn400 = vi.fn().mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    await expect(withRetry(fn400, [1, 1])).rejects.toThrow(/bad/);
    expect(fn400).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(Object.assign(new Error('overloaded'), { status: 503 }));
    await expect(withRetry(fn, [1, 1])).rejects.toThrow(/overloaded/);
    expect(fn).toHaveBeenCalledTimes(3); // 1 attempt + 2 retries
  });

  it('detects transient via message ("rate limit", "overloaded")', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('The provider is overloaded, try again'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, [1])).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
