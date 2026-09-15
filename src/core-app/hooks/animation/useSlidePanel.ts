import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

/**
 * gapPx: pass the parent's gap value (e.g. 8 for gap-2) when the wrapper is
 * ALWAYS in the DOM (like the plugin panel). The hook will set marginLeft to
 * -gapPx when closed so the phantom gap from the parent's CSS gap is cancelled,
 * and animate it back to 0 when opening. Omit for panels that use the `mounted`
 * gate — they are removed from the DOM when closed so there is no phantom gap.
 */
export function useSlidePanel(
  visible: boolean,
  options?: { duration?: number; ease?: string; gapPx?: number },
) {
  const { duration = 0.4, ease = 'power2.out', gapPx } = options ?? {};
  const easeClose = 'power2.in';
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const panel = panelRef.current;
    if (!wrapper || !panel) return;

    gsap.killTweensOf([wrapper, panel]);

    // Snap to closed state on first encounter with no animation to avoid flash.
    if (!initialized.current) {
      initialized.current = true;
      if (!visible) {
        gsap.set(wrapper, { width: 0, ...(gapPx ? { marginLeft: -gapPx } : {}) });
        gsap.set(panel, { x: '100%', opacity: 0 });
        return;
      }
    }

    if (visible) {
      gsap.set(wrapper, { width: 'auto' });
      const targetWidth = wrapper.offsetWidth;
      gsap.set(wrapper, { width: 0 });
      gsap.to(wrapper, {
        width: targetWidth,
        duration,
        ease,
        ...(gapPx ? { marginLeft: 0 } : {}),
      });
      gsap.fromTo(panel, { x: '100%', opacity: 0 }, { x: 0, opacity: 1, duration, ease });
    } else {
      gsap.to(wrapper, {
        width: 0,
        duration,
        ease: easeClose,
        ...(gapPx ? { marginLeft: -gapPx } : {}),
        onComplete: () => setMounted(false),
      });
      gsap.to(panel, { x: '100%', opacity: 0, duration, ease: easeClose });
    }
  }, [visible, mounted]);

  return { wrapperRef, panelRef, mounted };
}
