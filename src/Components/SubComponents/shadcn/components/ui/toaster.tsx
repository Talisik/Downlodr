import { useToast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import {
  ExpandableToastDescription,
  Toast,
  ToastActions,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        expandable,
        variant,
        ...props
      }) {
        return (
          <Toast key={id} expandable={expandable} variant={variant} {...props}>
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-start justify-between gap-2">
                <ToastTitle variant={variant} className="min-w-0">
                  {title}
                </ToastTitle>

                <ToastActions hasTitle variant={variant}>
                  {action}
                </ToastActions>
              </div>

              {!expandable && description && (
                <ToastDescription>{description}</ToastDescription>
              )}

              {expandable && description && (
                <ExpandableToastDescription>
                  {description}
                </ExpandableToastDescription>
              )}
            </div>
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
