import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import * as React from 'react';

// New interface for clickable icons
export interface ClickableIcon {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  parentInputClassName?: string;
  leftIcons?: (React.ReactNode | ClickableIcon)[];
  rightIcons?: (React.ReactNode | ClickableIcon)[];
  actionIcon?: {
    icon: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    showDivider?: boolean;
    tooltip?: string;
  };
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      parentInputClassName,
      leftIcons = [],
      rightIcons = [],
      actionIcon,
      type,
      maxLength,
      ...props
    },
    ref,
  ) => {
    // Helper function to check if an icon is clickable
    const isClickableIcon = (
      icon: React.ReactNode | ClickableIcon,
    ): icon is ClickableIcon => {
      return typeof icon === 'object' && icon !== null && 'icon' in icon;
    };

    // Calculate dynamic padding based on icons
    const getPaddingStyles = () => {
      let paddingLeft = 12;
      let paddingRight = 12;

      if (leftIcons.length > 0) {
        paddingLeft = 8 + leftIcons.length * 24; // 8px base + (20px icon width + 4px spacing) * number of icons
      }

      if (rightIcons.length > 0 || actionIcon) {
        let rightSpace = 20;

        if (rightIcons.length > 0) {
          rightSpace += rightIcons.length * 24;
        }

        if (actionIcon) {
          rightSpace += 32; // 24px icon + 8px for divider spacing
        }

        paddingRight = rightSpace;
      }

      return {
        paddingLeft: `${paddingLeft}px`,
        paddingRight: `${paddingRight}px`,
      };
    };

    // Render clickable or non-clickable icon
    const renderIcon = (
      iconItem: React.ReactNode | ClickableIcon,
      index: number,
    ) => {
      if (isClickableIcon(iconItem)) {
        const button = (
          <button
            key={index}
            type="button"
            onClick={iconItem.onClick}
            disabled={iconItem.disabled}
            aria-label={iconItem.tooltip || 'Icon button'}
            className={cn(
              'flex items-center justify-center w-5 h-5 text-textPrimary-500 hover:text-textPrimary-700 transition-colors rounded focus:outline-none',
              iconItem.disabled &&
                'opacity-50 cursor-not-allowed hover:text-textPrimary-500',
            )}
          >
            {iconItem.icon}
          </button>
        );

        // Display tooltip if provided
        if (iconItem.tooltip) {
          return (
            <TooltipWrapper
              key={index}
              content={iconItem.tooltip}
              side="bottom"
            >
              {button}
            </TooltipWrapper>
          );
        }

        return button;
      } else {
        return (
          <div
            key={index}
            className="flex items-center justify-center w-5 h-5 text-textPrimary-500"
          >
            {iconItem}
          </div>
        );
      }
    };

    return (
      <div className={cn('relative', parentInputClassName)}>
        {/* Main Input */}
        <input
          type={type}
          className={cn(
            'flex h-7 w-full rounded-md duration-300 transition bg-transparent dark:bg-darkModeDropdown border border-[#D1D5DB] dark:border-none py-1 text-sm shadow-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-componentBorder disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          style={getPaddingStyles()}
          ref={ref}
          maxLength={maxLength}
          {...props}
        />

        {/* Left Icons */}
        {leftIcons.length > 0 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
            {leftIcons.map((leftIcon, index) => renderIcon(leftIcon, index))}
          </div>
        )}

        {/* Right Icons and Action Icon Container */}
        {(rightIcons.length > 0 || actionIcon) && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {/* Right Icons */}
            {rightIcons.length > 0 && (
              <div className="flex items-center space-x-2">
                {rightIcons.map((rightIcon, index) =>
                  renderIcon(rightIcon, index),
                )}
              </div>
            )}

            {/* Divider */}
            {((rightIcons.length > 0 && actionIcon) ||
              actionIcon?.showDivider) && (
              <div className="h-7 w-px bg-[#D1D5DB] dark:bg-gray-600 mx-2" />
            )}

            {/* Action Icon Button */}
            {actionIcon && (
              <>
                {actionIcon.tooltip ? (
                  <TooltipWrapper content={actionIcon.tooltip} side="bottom">
                    <button
                      type="button"
                      onClick={actionIcon.onClick}
                      disabled={actionIcon.disabled}
                      className={cn(
                        'flex items-center justify-center w-5 h-5 text-textPrimary-500 hover:text-textPrimary-700 transition-colors rounded focus:outline-none',
                        actionIcon.disabled &&
                          'opacity-50 cursor-not-allowed hover:text-textPrimary-500',
                      )}
                    >
                      {actionIcon.icon}
                    </button>
                  </TooltipWrapper>
                ) : (
                  <button
                    type="button"
                    onClick={actionIcon.onClick}
                    disabled={actionIcon.disabled}
                    className={cn(
                      'flex items-center justify-center w-5 h-5 text-textPrimary-500 hover:text-textPrimary-700 transition-colors rounded',
                      'focus:outline-none focus:ring-1 focus:ring-slate-950',
                      actionIcon.disabled &&
                        'opacity-50 cursor-not-allowed hover:text-textPrimary-500',
                    )}
                  >
                    {actionIcon.icon}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
