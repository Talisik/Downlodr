import { describe, expect, it } from 'vitest';
import { runExclusiveYtdlpUpdate, waitForYtdlpUpdate } from './ytdlpUpdateGate';

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('ytdlpUpdateGate', () => {
  it('lets work through immediately when no update is running', async () => {
    await expect(waitForYtdlpUpdate()).resolves.toBeUndefined();
  });

  it('holds work until the running update finishes', async () => {
    const update = deferred();
    const running = runExclusiveYtdlpUpdate(() => update.promise);
    let released = false;
    const waiting = waitForYtdlpUpdate().then(() => {
      released = true;
    });
    await Promise.resolve();
    expect(released).toBe(false);
    update.resolve();
    await running;
    await waiting;
    expect(released).toBe(true);
  });

  it('releases waiting work even when the update fails', async () => {
    const update = deferred();
    const running = runExclusiveYtdlpUpdate(() => update.promise);
    const waiting = waitForYtdlpUpdate();
    update.reject(new Error('network down'));
    await expect(running).rejects.toThrow('network down');
    await expect(waiting).resolves.toBeUndefined();
    await expect(waitForYtdlpUpdate()).resolves.toBeUndefined();
  });
});
