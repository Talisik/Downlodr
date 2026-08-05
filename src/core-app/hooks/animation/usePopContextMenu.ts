import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';

export function useContextMenuAnimation() {
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const menu = menuRef.current;

    if (!menu) return;

    gsap.fromTo(
      menu,
      {
        opacity: 0,
        scale: 0.98,
        y: 4,
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.12,
        ease: 'power2.out',
      },
    );
  }, []);

  return { menuRef };
}