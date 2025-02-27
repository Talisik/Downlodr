/**
 * A custom React component
 * A React component that displays an animated circular progress bar.
 * It visually represents progress with customizable colors and status indicators.
 *
 * @param AnimatedCircularProgressBarProps
 *   @param status - The current status of the progress (e.g., 'paused', 'to download').
 *   @param max - The maximum value for the progress.
 *   @param value - The current value of the progress.
 *   @param min - The minimum value for the progress.
 *   @param gaugePrimaryColor - The primary color of the progress gauge.
 *   @param gaugeSecondaryColor - The secondary color of the progress gauge.
 *   @param className - Optional additional CSS classes for styling.
 *
 * @returns JSX.Element - The rendered animated circular progress bar component.
 */

import { cn } from '../shadcn/lib/utils';
import { MdPause } from 'react-icons/md';
import { FaPlay } from 'react-icons/fa';

interface AnimatedCircularProgressBarProps {
  status: string; // Current status of the progress
  max: number; // Maximum value for the progress
  value: number; // Current value of the progress
  min: number; // Minimum value for the progress
  gaugePrimaryColor: string; // Primary color of the progress gauge
  gaugeSecondaryColor: string; // Secondary color of the progress gauge
  className?: string; // Optional additional CSS classes
}

export function AnimatedCircularProgressBar({
  status,
  max = 200,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
}: AnimatedCircularProgressBarProps) {
  const circumference = 2 * Math.PI * 45;
  const percentPx = circumference / 100;
  const currentPercent = Math.round(((value - min) / (max - min)) * 100);

  return (
    <div
      className={cn('relative size-12 text-sm font-semibold', className)}
      style={
        {
          '--circle-size': '100px',
          '--circumference': circumference,
          '--percent-to-px': `${percentPx}px`,
          '--gap-percent': '5',
          '--offset-factor': '0',
          '--transition-length': '1s',
          '--transition-step': '200ms',
          '--delay': '0s',
          '--percent-to-deg': '3.6deg',
          transform: 'translateZ(0)',
        } as React.CSSProperties
      }
    >
      <svg
        fill="none"
        className="size-full"
        strokeWidth="2"
        viewBox="0 0 100 100"
      >
        {currentPercent <= 90 && currentPercent >= 0 && (
          <circle
            cx="50"
            cy="50"
            r="45"
            strokeWidth="10"
            strokeDashoffset="0"
            strokeLinecap="round"
            strokeLinejoin="round"
            className=" opacity-100"
            style={
              {
                stroke: gaugeSecondaryColor,
                '--stroke-percent': 90 - currentPercent,
                '--offset-factor-secondary': 'calc(1 - var(--offset-factor))',
                strokeDasharray:
                  'calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)',
                transform:
                  'rotate(calc(1turn - 90deg - (var(--gap-percent) * var(--percent-to-deg) * var(--offset-factor-secondary)))) scaleY(-1)',
                transition: 'all var(--transition-length) ease var(--delay)',
                transformOrigin:
                  'calc(var(--circle-size) / 2) calc(var(--circle-size) / 2)',
              } as React.CSSProperties
            }
          />
        )}
        <circle
          cx="50"
          cy="50"
          r="45"
          strokeWidth="10"
          strokeDashoffset="0"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-100"
          style={
            {
              stroke: gaugePrimaryColor,
              '--stroke-percent': currentPercent,
              strokeDasharray:
                'calc(var(--stroke-percent) * var(--percent-to-px)) var(--circumference)',
              transition:
                'var(--transition-length) ease var(--delay),stroke var(--transition-length) ease var(--delay)',
              transitionProperty: 'stroke-dasharray,transform',
              transform:
                'rotate(calc(-90deg + var(--gap-percent) * var(--offset-factor) * var(--percent-to-deg)))',
              transformOrigin:
                'calc(var(--circle-size) / 2) calc(var(--circle-size) / 2)',
            } as React.CSSProperties
          }
        />
      </svg>
      <span
        data-current-value={currentPercent}
        className="duration-[var(--transition-length)] delay-[var(--delay)] absolute inset-0 m-auto size-fit ease-linear animate-in fade-in m-2"
      >
        {status === 'paused' ? (
          <span>
            <MdPause size={20} />
          </span>
        ) : status === 'to download' ? (
          <FaPlay />
        ) : (
          <span>{currentPercent}%</span>
        )}
      </span>
    </div>
  );
}
