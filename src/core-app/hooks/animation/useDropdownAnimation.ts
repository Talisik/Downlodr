import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useDropdownAnimation(visible: boolean): {
  ref: RefObject<HTMLDivElement>;
  mounted: boolean;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(visible);
  const initialized = useRef(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    const element = ref.current;
    if (!element) return;

    gsap.killTweensOf(element);

    if (!initialized.current) {
      initialized.current = true;
      if (!visible) {
        gsap.set(element, { opacity: 0, scale: 0.97, y: -4 });
      }
      return;
    }

    if (visible) {
      gsap.fromTo(
        element,
        { opacity: 0, scale: 0.97, y: -4 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.35,
          ease: 'circ.out',
          onComplete: () => gsap.set(element, { clearProps: 'transform' }),
        },
      );
    } else {
      gsap.to(element, {
        opacity: 0,
        scale: 0.97,
        y: -4,
        duration: 0.2,
        ease: 'circ.in',
        onComplete: () => {
          setMounted(false);
        },
      });
    }
  }, [visible, mounted]);

  return { ref, mounted };
}
