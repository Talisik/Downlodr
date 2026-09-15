import * as ToastPrimitives from '@radix-ui/react-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, X } from 'lucide-react';

type UpdatePhase = 'downloading' | 'ready' | 'error';

interface UpdateState {
  phase: UpdatePhase;
  version?: string;
  percent: number;
  transferred: number;
  total: number;
  error?: string;
}

function fmtMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

const PhaseIcon: React.FC<{ phase: UpdatePhase }> = ({ phase }) => {
  if (phase === 'downloading')
    return (
      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 dark:bg-primary/20">
        <Download className="w-3.5 h-3.5 text-primary animate-bounce" />
      </div>
    );
  if (phase === 'ready')
    return (
      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
      </div>
    );
  return (
    <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30">
      <AlertCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
    </div>
  );
};

const AutoUpdateToast: React.FC = () => {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const stateRef = useRef<UpdateState | null>(null);

  const bridge = window.updateFunctionsBridge;

  const set = (s: UpdateState | null) => {
    stateRef.current = s;
    setUpdateState(s);
  };

  useEffect(() => {
    if (!bridge) return;

    // 1. Subscribe first — nothing will be missed
    const removeStarted = bridge.onAutoUpdateStarted((info) => {
      setDismissed(false);
      set({ phase: 'downloading', version: info.updateInfo?.latestVersion, percent: 0, transferred: 0, total: 0 });
    });

    const removeProgress = bridge.onAutoUpdateProgress((p) => {
      set({ phase: 'downloading', version: stateRef.current?.version, percent: p.percent, transferred: p.transferred, total: p.total });
    });

    const removeReady = bridge.onAutoUpdateReady((info) => {
      setDismissed(false);
      set({ phase: 'ready', version: info.updateInfo?.latestVersion ?? stateRef.current?.version, percent: 100, transferred: 0, total: 0 });
    });

    const removeError = bridge.onAutoUpdateError((info) => {
      setDismissed(false);
      set({ phase: 'error', version: stateRef.current?.version, percent: 0, transferred: 0, total: 0, error: info.error });
    });

    // 2. Sync current state (covers 4-hour interval firing while app was open)
    bridge.getAutoUpdateState().then((state) => {
      if (stateRef.current) return;
      if (state.status === 'downloading') {
        set({ phase: 'downloading', version: state.updateInfo?.latestVersion, percent: state.percent ?? 0, transferred: state.transferred ?? 0, total: state.total ?? 0 });
      } else if (state.status === 'ready') {
        set({ phase: 'ready', version: state.updateInfo?.latestVersion, percent: 100, transferred: 0, total: 0 });
      }
    });

    // 3. Trigger the startup check — listeners are registered above
    bridge.startAutoUpdateCheck();

    return () => { removeStarted(); removeProgress(); removeReady(); removeError(); };
  }, []);

  const open = updateState !== null && !dismissed;

  return (
    <ToastPrimitives.Root
      open={open}
      onOpenChange={(o) => { if (!o) setDismissed(true); }}
      duration={Infinity}
      className={cn(
        // Radix-driven enter/exit animations (matches other toasts)
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
        'data-[state=open]:slide-in-from-bottom-full',
        // Card shell — no positioning, Radix viewport owns that
        'pointer-events-auto w-[395px] rounded-xl overflow-hidden shadow-lg',
        'border border-gray-200 dark:border-darkModeBorderColor',
        'bg-white dark:bg-darkModeDropdown',
      )}
    >
      {/* Top accent stripe */}
      <div
        className={cn(
          'h-1 w-full',
          updateState?.phase === 'downloading' && 'bg-primary',
          updateState?.phase === 'ready' && 'bg-green-500',
          updateState?.phase === 'error' && 'bg-red-500',
        )}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          {updateState && <PhaseIcon phase={updateState.phase} />}

          <div className="flex-1 min-w-0">
            <ToastPrimitives.Title className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
              {updateState?.phase === 'downloading' && `Downloading update${updateState.version ? ` v${updateState.version}` : ''}`}
              {updateState?.phase === 'ready' && `Update${updateState.version ? ` v${updateState.version}` : ''} ready`}
              {updateState?.phase === 'error' && 'Update download failed'}
            </ToastPrimitives.Title>
            <ToastPrimitives.Description className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
              {updateState?.phase === 'downloading' && 'Installing automatically in the background'}
              {updateState?.phase === 'ready' && 'Restart the app to apply the update'}
              {updateState?.phase === 'error' && (updateState.error || 'Please try again later')}
            </ToastPrimitives.Description>
          </div>

          <ToastPrimitives.Close
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeHover transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </ToastPrimitives.Close>
        </div>

        {/* Progress bar */}
        {updateState?.phase === 'downloading' && (
          <div className="mt-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {updateState.total > 0 ? `${fmtMB(updateState.transferred)} / ${fmtMB(updateState.total)} MB` : 'Starting…'}
              </span>
              <span className="text-xs font-medium text-primary">{updateState.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-darkModeCompliment rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${updateState.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Ready actions */}
        {updateState?.phase === 'ready' && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-[13px] font-medium rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-darkModeHover transition-colors"
            >
              Later
            </button>
            <button
              onClick={() => bridge?.installUpdate()}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              Restart Now
            </button>
          </div>
        )}

        {/* Error dismiss */}
        {updateState?.phase === 'error' && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-darkModeHover transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </ToastPrimitives.Root>
  );
};

export default AutoUpdateToast;
