import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/Components/SubComponents/shadcn/lib/utils';

const buttonVariants = cva(
  'whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-slate-900 text-slate-50 hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90',
        destructive:
          'bg-red-500 text-slate-50 hover:bg-red-500/90 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/90',
        outline:
          'border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:text-slate-50',
        secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-100/80 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-800/80',
        ghost:
          'hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50',
        link: 'text-slate-900 underline-offset-4 hover:underline dark:text-slate-50',
        transparent:
          'bg-transparent hover:bg-transparent dark:hover:bg-transparent',
      },
      size: {
        default: 'h-7 px-4 py-2',
        sm: 'h-6 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'size-fit',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  icon?: React.ReactNode;
  childClass?: string;
  loading?: boolean;
  loaderColor?: string;
  loaderHeight?: number;
  loaderWidth?: number;
  innerChildClass?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon,
      childClass,
      loading = false,
      loaderWidth,
      loaderHeight,
      loaderColor,
      innerChildClass,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn('', buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {loading || icon ? (
          <div
            className={cn('flex items-center justify-center gap-2', childClass)}
          >
            {loading && (
              <div
                className="!me-0 flex-shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{
                  width: loaderWidth || 16,
                  height: loaderHeight || 16,
                  borderColor: loaderColor || 'currentColor',
                  borderTopColor: 'transparent',
                }}
              />
            )}
            {!loading && icon}

            {children && <span className={innerChildClass}>{children}</span>}
          </div>
        ) : (
          <span className={innerChildClass}>{children}</span>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

