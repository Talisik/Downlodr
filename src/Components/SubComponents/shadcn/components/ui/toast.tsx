/* eslint-disable prettier/prettier */
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDown, X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import { BsFillXOctagonFill } from 'react-icons/bs';

const ToastProvider = ToastPrimitives.Provider;

interface ToastContextValue {
  isExpanded: boolean;
  toggleExpanded: () => void;
  isExpandable: boolean;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export const useToastContext = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a Toast component');
  }
  return context;
};

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 z-[100000] flex max-h-screen w-full flex-col-reverse p-2 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col sm:w-auto',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  'group pointer-events-auto relative flex flex-col items-start gap-2 overflow-visible rounded-xl shadow-lg transition-all ...',
  {
    variants: {
      variant: {
        default:
          'bg-white text-slate-950 dark:bg-darkModeDropdown dark:text-slate-50',
        destructive:
          'destructive group bg-destructiveToast text-slate-50 dark:bg-destructiveToast dark:text-slate-50',
        success:
          'success group bg-green-500 text-slate-50 dark:bg-green-900 dark:text-slate-50',
      },
      padding: {
        default: 'p-4 pr-4',
        compact: 'py-3 px-4 pr-4',
      },
      width: {
        default: 'w-[28rem]',
        expanded: 'w-[28rem]',
        wide: 'w-[28rem]',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'default',
      width: 'default',
    },
  },
);

const toastHoverVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const toastCloseVariants = cva('', {
  variants: {
    variant: {
      default: 'text-slate-500 dark:text-slate-400',
      destructive: 'text-slate-50 dark:text-slate-50',
      success: 'text-slate-50 dark:text-slate-50',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const toastActionsVariants = cva('', {
  variants: {
    variant: {
      default: '',
      destructive: '',
      success: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> & {
      expandable?: boolean;
    }
>(({ className, variant, expandable = false, children, ...props }, ref) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements like buttons
    if ((e.target as HTMLElement).closest('button, [role="button"], [toast-close]')) {
      return;
    }
    if (expandable) {
      setIsExpanded(!isExpanded);
    }
  };

  const contextValue: ToastContextValue = {
    isExpanded,
    toggleExpanded: () => setIsExpanded(!isExpanded),
    isExpandable: expandable,
  };

  // Determine padding and width based on expandable state and expansion
  const effectivePadding = expandable && !isExpanded ? 'compact' : 'default';
  const effectiveWidth = expandable && !isExpanded ? 'wide' : 'default';

  return (
    <ToastContext.Provider value={contextValue}>
      <ToastPrimitives.Root
        ref={ref}
        className={cn(
          toastVariants({ variant, padding: effectivePadding, width: effectiveWidth }),
          expandable && cn('cursor-pointer', toastHoverVariants({ variant })),
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </ToastPrimitives.Root>
    </ToastContext.Provider>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'flex items-center justify-center transition-transform duration-200',
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close> &
    VariantProps<typeof toastCloseVariants>
>(({ className, variant, ...props }, ref) => {
  const { isExpanded, isExpandable } = useToastContext();
 return (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'flex items-center justify-center transition-transform duration-200',
      isExpanded && isExpandable && 'top-1',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X size={12} className={cn('h-4 w-4', toastCloseVariants({ variant }))} />
  </ToastPrimitives.Close>
 );
});
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
  &
    VariantProps<typeof toastCloseVariants>
>(({ className, variant, children, ...props }, ref) => {
  const { isExpanded } = useToastContext();
  return (

    <ToastPrimitives.Title
      ref={ref}
      className={cn('text-[14.5px] font-semibold mb-1 flex items-center gap-2', className, !isExpanded ? 'mt-1' : '')}
      {...props}
    >
      {variant === 'destructive' && <BsFillXOctagonFill size={16} className="flex-shrink-0" />}
      {children}
    </ToastPrimitives.Title>
  );
});
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-[13.5px] opacity-90 break-words overflow-wrap-anywhere', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

const ExpandableToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => {
  const { isExpanded } = useToastContext();

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-white rounded-b-xl -mx-4 -mb-4 px-4 pb-4 pt-2 mt-1">
      <ToastPrimitives.Description
        ref={ref}
        className={cn('text-xs text-slate-950 break-words overflow-wrap-anywhere', className)}
        {...props}
      />
    </div>
  );
});
ExpandableToastDescription.displayName = 'ExpandableToastDescription';

const ToastExpandIndicator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof toastCloseVariants>
>(({ className, variant, ...props }, ref) => {
  const { isExpanded, isExpandable } = useToastContext();

  if (!isExpandable) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-center transition-transform duration-200',
        className
      )}
      {...props}
    >
    <ChevronDown size={12} className={cn('h-4 w-4', toastCloseVariants({ variant }))} />
    </div>
  );
});
ToastExpandIndicator.displayName = 'ToastExpandIndicator';

const ToastActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    hasTitle?: boolean;
    variant?: VariantProps<typeof toastCloseVariants>['variant'];
  }
>(({ className, hasTitle, variant, children, ...props }, ref) => {
  const { isExpanded } = useToastContext();

  return (
    <div
      ref={ref}
      className={cn(
        'flex gap-2 rounded-md transition-colors duration-200 cursor-pointer',
        hasTitle ? 'items-start' : 'items-center',
        !isExpanded ? 'mt-1.5' : '',
        toastActionsVariants({ variant }),
        className
      )}
      {...props}
    >
      <ToastClose variant={variant} />
      <ToastExpandIndicator variant={variant} />
      {children}
    </div>
  );
});
ToastActions.displayName = 'ToastActions';

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  ExpandableToastDescription, Toast,
  ToastAction,
  ToastActions,
  ToastClose,
  ToastDescription, ToastExpandIndicator,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastActionElement,
  type ToastProps
};

