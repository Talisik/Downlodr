import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useIconToggleAnimation(theme: string): {
  sunRef: RefObject<SVGSVGElement>;
  moonRef: RefObject<SVGSVGElement>;
} {
  const sunRef = useRef<SVGSVGElement>(null);
  const moonRef = useRef<SVGSVGElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const sun = sunRef.current;
    const moon = moonRef.current;
    if (!sun || !moon) return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (!initialized.current) {
      initialized.current = true;
      if (isDark) {
        gsap.set(sun, { scale: 0, opacity: 0 });
        gsap.set(moon, { scale: 1, opacity: 1 });
      } else {
        gsap.set(sun, { scale: 1, opacity: 1 });
        gsap.set(moon, { scale: 0, opacity: 0 });
      }
      return;
    }

    gsap.killTweensOf([sun, moon]);

    const outgoing = isDark ? sun : moon;
    const incoming = isDark ? moon : sun;

    gsap.to(outgoing, { scale: 0, opacity: 0, duration: 0.12, ease: 'power2.in' });
    gsap.fromTo(
      incoming,
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.2,
        ease: 'back.out(1.8)',
        delay: 0.1,
        onComplete: () => gsap.set(incoming, { clearProps: 'all' }),
      },
    );
  }, [theme]);

  return { sunRef, moonRef };
}
