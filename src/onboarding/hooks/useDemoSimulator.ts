import { useCallback, useEffect, useRef, useState } from 'react';

export type DemoStatus = 'idle' | 'running' | 'complete';

export interface DemoSimulator {
  progress: number;
  status: DemoStatus;
  start: () => void;
  reset: () => void;
}

export function useDemoSimulator(durationMs = 3000): DemoSimulator {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DemoStatus>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = useCallback(() => {
    clear();
    setProgress(0);
    setStatus('running');
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const next = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(next);
      if (next >= 100) {
        clear();
        setStatus('complete');
      }
    }, 50);
  }, [durationMs]);

  const reset = useCallback(() => {
    clear();
    setProgress(0);
    setStatus('idle');
  }, []);

  useEffect(() => () => clear(), []);

  return { progress, status, start, reset };
}
