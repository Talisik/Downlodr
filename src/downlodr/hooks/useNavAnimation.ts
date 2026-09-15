import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';

const COLLAPSED_W = 70;
const EXPANDED_W = 205;
const LABEL_MAX_W = 200;

export function useNavAnimation(
  navRef: React.RefObject<HTMLElement>,
  collapsed: boolean,
  userToggledRef: React.RefObject<boolean>,
) {
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  // Set initial state before first paint — no animation flash
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    gsap.set(nav, { width: collapsed ? COLLAPSED_W : EXPANDED_W });

    const labels = nav.querySelectorAll<HTMLElement>('.nav-label');
    gsap.set(labels, { maxWidth: collapsed ? 0 : LABEL_MAX_W, opacity: collapsed ? 0 : 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Programmatic change (e.g. responsive breakpoint resize) — snap without
    // animation so GSAP inline styles stay in sync with the collapsed prop.
    if (!userToggledRef.current) {
      const labels = nav.querySelectorAll<HTMLElement>('.nav-label');
      gsap.set(nav, { width: collapsed ? COLLAPSED_W : EXPANDED_W });
      gsap.set(labels, {
        maxWidth: collapsed ? 0 : LABEL_MAX_W,
        opacity: collapsed ? 0 : 1,
      });
      return;
    }
    // Only animate when the user explicitly clicked the toggle — not on mount or
    // store hydration (Zustand's IndexedDB persist resolves asynchronously and
    // would otherwise fire the expand animation on every navigation into this layout).
    userToggledRef.current = false;

    const labels = nav.querySelectorAll<HTMLElement>('.nav-label');

    tlRef.current?.kill();
    const tl = gsap.timeline();
    tlRef.current = tl;

    if (collapsed) {
      // Slide out via maxWidth clip while nav shrinks
      tl.to(labels, {
        maxWidth: 0,
        duration: 0.14,
        ease: 'power3.out',
        stagger: { each: 0.006, from: 'start' },
      }, 0)
        .to(nav, { width: COLLAPSED_W, duration: 0.28, ease: 'power3.inOut' }, 0);
    } else {
      // Give labels room first, then fade each in one by one
      gsap.set(labels, { maxWidth: LABEL_MAX_W, opacity: 0 });
      tl.to(nav, {
        width: EXPANDED_W,
        duration: 0.28,
        ease: 'power3.inOut',
      }).to(
        labels,
        {
          opacity: 1,
          duration: 0.25,
          ease: 'power3.in',
        },
        '-=0.1',
      );
    }

    return () => {
      tl.kill();
    };
  }, [collapsed]);
}
