import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

export function useModalAnimation(
  visible: boolean,
  options?: {
    duration?: number;
    ease?: string;
    closeEase?: string;
  },
) {
  const {
    duration = 0.2,
    ease = 'power3.out',
    closeEase = 'power2.in',
  } = options ?? {};

  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(visible);
  const initialized = useRef(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) return;

    const overlay = overlayRef.current;
    const modal = modalRef.current;

    if (!overlay || !modal) return;

    gsap.killTweensOf([overlay, modal]);

    // Prevent initial flash
    if (!initialized.current) {
      initialized.current = true;

      if (!visible) {
        // Nothing was ever shown — unmount instead of leaving an invisible
        // full-screen overlay in the DOM that blocks all pointer events.
        setMounted(false);
        return;
      }
    }

    if (visible) {
      gsap.fromTo(
        overlay,
        { opacity: 0 },
        {
          opacity: 1,
          duration,
          ease,
        },
      );

      gsap.fromTo(
        modal,
        {
          opacity: 0,
          y: 16,
          scale: 0.96,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.25,
          ease: 'back.out(1.4)',
        },
      );
    } else {
      gsap.to(overlay, {
        opacity: 0,
        duration,
        ease: closeEase,
      });

      gsap.to(modal, {
        opacity: 0,
        y: 16,
        scale: 0.96,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          setMounted(false);
        },
      });
    }
  }, [visible, mounted, duration, ease, closeEase]);

  return {
    overlayRef,
    modalRef,
    mounted,
  };
}
