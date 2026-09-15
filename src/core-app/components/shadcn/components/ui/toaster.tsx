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
        ...props
      }) {
        return (
          <AnimatedToast key={id}>
            <Toast variant={variant} {...props}>
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
              </div>
              {action}
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
