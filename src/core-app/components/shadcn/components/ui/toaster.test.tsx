import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/core-app/components/shadcn/components/ui/toaster';
import { toast, useToast } from '@/core-app/components/shadcn/hooks/use-toast';

vi.mock('@/core-app/components/notification/AutoUpdateToast', () => ({
  default: (): null => null,
}));

let snapshot: ReturnType<typeof useToast> | null = null;
const Spy = (): null => {
  snapshot = useToast();
  return null;
};
const openTitles = () =>
  snapshot!.toasts.filter((t) => t.open).map((t) => t.title);

describe('Toaster — stacked toast lifetime', () => {
  afterEach(() => {
    // Toasts live in module state shared by every Toaster, so unmount this
    // test's tree and close its toasts before the next test renders.
    cleanup();
    vi.useRealTimers();
    act(() => snapshot?.dismiss());
  });

  it('closes stacked toasts after their duration', async () => {
    vi.useFakeTimers();
    render(
      <>
        <Toaster />
        <Spy />
      </>,
    );
    await act(async () => {
      toast({ title: 'one', duration: 5000 });
      toast({ title: 'two', duration: 5000 });
    });
    await act(async () => {
      vi.advanceTimersByTime(5500);
    });
    expect(openTitles()).toEqual([]);
  });

  it('keeps timing the other toast after one is closed with X', async () => {
    // Radix moves focus into the toast viewport when a focused toast closes,
    // and pauses every toast's timer while focus is inside it.
    vi.useFakeTimers();
    render(
      <>
        <Toaster />
        <Spy />
      </>,
    );
    await act(async () => {
      toast({ title: 'one', duration: 5000 });
      toast({ title: 'two', duration: 5000 });
    });
    const close = document.querySelectorAll<HTMLElement>('[toast-close]')[0];
    await act(async () => {
      fireEvent.pointerMove(close);
      close.focus();
      fireEvent.click(close);
    });
    const region = document.querySelector('[role="region"]')!;
    await act(async () => {
      fireEvent.pointerLeave(region);
    });
    await act(async () => {
      vi.advanceTimersByTime(5500);
    });
    expect(openTitles()).toEqual([]);
  });
});
