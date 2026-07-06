import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';

export function useToastAnimation() {
  const toastRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const toast = toastRef.current;

    if (!toast) return;

    gsap.fromTo(
      toast,
      {
        opacity: 0,
        x: 40,
        scale: 0.96,
      },
      {
        opacity: 1,
        x: 0,
        scale: 1,
        duration: 0.25,
        ease: 'power3.out',
      },
    );

    return () => {
      gsap.killTweensOf(toast);
    };
  }, []);

  return { toastRef };
}
