import AutoUpdateToast from '@/core-app/components/notification/AutoUpdateToast';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';
import { useToastAnimation } from '@/core-app/hooks/animation/useSlideToast';

function ToastIcon({ variant }: { variant?: string }) {
  const baseClass = 'h-6 w-6 shrink-0';
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`${baseClass} text-white`} />;
    case 'destructive':
      return <XCircle className={`${baseClass} text-white`} />;
    case 'progress':
      return <Loader2 className={`${baseClass} text-white animate-spin`} />;
    default:
      return (
        <Info className={`${baseClass} text-gray-600 dark:text-slate-300`} />
      );
  }
}

// Radix pauses every toast's timer while focus is inside the toast viewport,
// and when a focused toast closes (its X was clicked) it moves focus onto the
// viewport itself — so with toasts stacked, the rest never time out until the
// user clicks elsewhere. Drop that focus once the toast has closed.
function releaseViewportFocus() {
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest('[data-toast-viewport]')) active.blur();
}

function AnimatedToast({ children }: { children: React.ReactNode }) {
  const { toastRef } = useToastAnimation();

  return <div ref={toastRef}>{children}</div>;
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        onOpenChange,
        ...props
      }) {
        return (
          <AnimatedToast key={id}>
            <Toast
              variant={variant}
              {...props}
              onOpenChange={(open) => {
                onOpenChange?.(open);
                if (!open) releaseViewportFocus();
              }}
            >
              <ToastIcon variant={variant} />
              <div className="flex-1 min-w-0">
                {title && (
                  <ToastTitle className="text-sm sm:text-base break-words font-bold">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-xs sm:text-sm">
                    {description}
                  </ToastDescription>
                )}
                {/* Actions sit under the text, right-aligned — except on
                    progress toasts, which keep theirs beside the title. */}
                {action && variant !== 'progress' && (
                  <div className="mt-2 flex justify-end">{action}</div>
                )}
              </div>
              {variant === 'progress' && action}
              <ToastClose />
            </Toast>
          </AnimatedToast>
        );
      })}
      {/* Update notification lives here so it shares the viewport and stacks naturally */}
      <AutoUpdateToast />
      <ToastViewport />
    </ToastProvider>
  );
}
