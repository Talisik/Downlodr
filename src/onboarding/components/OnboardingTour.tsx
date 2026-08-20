import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Joyride, {
  ACTIONS,
  CallBackProps,
  EVENTS,
  STATUS,
  TooltipRenderProps,
} from 'react-joyride';
import { OnboardingFeature } from '../types/onboardingTypes';
import { TOUR_STEPS } from '../hooks/useOnboardingTour';

interface OnboardingTourProps {
  active: OnboardingFeature;
  demoStarted: boolean;
  demoAnalyzed?: boolean;
  demoCompleted?: boolean;
  enabled?: boolean;
  /** Bump to restart the tour for the same feature (run latches off when a tour finishes). */
  restartKey?: number;
  onStepChange?: (index: number) => void;
}

const isRequiresInteraction = (s: unknown) =>
  (s as { data?: { requiresInteraction?: boolean } }).data?.requiresInteraction === true;

const isRequiresAnalyzed = (s: unknown) =>
  (s as { data?: { requiresAnalyzed?: boolean } }).data?.requiresAnalyzed === true;

const OnboardingTour: React.FC<OnboardingTourProps> = ({ active, demoStarted, demoAnalyzed = false, demoCompleted = false, enabled = true, restartKey = 0, onStepChange }) => {
  const steps = TOUR_STEPS[active] ?? [];
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    onStepChange?.(stepIndex);
  }, [stepIndex, onStepChange]);

  // Find requiresInteraction step indices
  const firstInteractionIdx = useMemo(
    () => steps.findIndex(isRequiresInteraction),
    [steps],
  );
  const secondInteractionIdx = useMemo(() => {
    if (firstInteractionIdx < 0) return -1;
    return steps.findIndex((s, i) => i > firstInteractionIdx && isRequiresInteraction(s));
  }, [steps, firstInteractionIdx]);

  // Find requiresAnalyzed step index (URL paste step)
  const analyzedIdx = useMemo(() => steps.findIndex(isRequiresAnalyzed), [steps]);

  // Reset and start tour when the active feature changes, or when the tour is
  // re-requested for the feature that's already active (restartKey bump)
  useEffect(() => {
    const featureSteps = TOUR_STEPS[active] ?? [];
    setStepIndex(0);
    setRun(featureSteps.length > 0 && enabled);
  }, [active, enabled, restartKey]);

  // Auto-advance past the 1st requiresInteraction step when the demo starts
  useEffect(() => {
    if (!demoStarted || firstInteractionIdx < 0) return;
    setStepIndex((prev) => (prev === firstInteractionIdx ? firstInteractionIdx + 1 : prev));
  }, [demoStarted, firstInteractionIdx]);

  // Auto-advance past the requiresAnalyzed step when URL analysis completes
  useEffect(() => {
    if (!demoAnalyzed || analyzedIdx < 0) return;
    setStepIndex((prev) => (prev === analyzedIdx ? analyzedIdx + 1 : prev));
  }, [demoAnalyzed, analyzedIdx]);

  // Auto-advance past the 2nd requiresInteraction step when the demo completes
  useEffect(() => {
    if (!demoCompleted || secondInteractionIdx < 0) return;
    setStepIndex((prev) => (prev === secondInteractionIdx ? secondInteractionIdx + 1 : prev));
  }, [demoCompleted, secondInteractionIdx]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRun(false);
      return;
    }

    // The tooltip's × emits STEP_AFTER with ACTIONS.CLOSE — without this it
    // falls through below and advances the tour instead of closing it
    if (action === ACTIONS.CLOSE) {
      setRun(false);
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  }, []);

  const tooltipComponent = useMemo(
    () =>
      (props: TooltipRenderProps) =>
        (
          <TourTooltip
            {...props}
            demoStarted={demoStarted}
            demoAnalyzed={demoAnalyzed}
            demoCompleted={demoCompleted}
            firstInteractionIdx={firstInteractionIdx}
            analyzedIdx={analyzedIdx}
            secondInteractionIdx={secondInteractionIdx}
            totalSteps={steps.length}
          />
        ),
    [demoStarted, demoAnalyzed, demoCompleted, firstInteractionIdx, analyzedIdx, secondInteractionIdx, steps.length],
  );

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      spotlightClicks
      spotlightPadding={0}
      disableScrolling
      disableOverlayClose
      tooltipComponent={tooltipComponent}
      callback={handleCallback}
      styles={{
        options: {
          arrowColor: 'transparent',
          overlayColor: 'rgba(0, 0, 0, 0.45)',
          spotlightShadow: '0 0 0 2px #F45513',
          zIndex: 1000,
        },
      }}
    />
  );
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TourTooltipProps extends TooltipRenderProps {
  demoStarted: boolean;
  demoAnalyzed: boolean;
  demoCompleted: boolean;
  firstInteractionIdx: number;
  analyzedIdx: number;
  secondInteractionIdx: number;
  totalSteps: number;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
  demoStarted,
  demoAnalyzed,
  demoCompleted,
  firstInteractionIdx,
  analyzedIdx,
  secondInteractionIdx,
  totalSteps,
}) => {
  const requiresInteraction = isRequiresInteraction(step);
  const requiresAnalyzed = isRequiresAnalyzed(step);
  const isNextDisabled =
    (requiresInteraction && index === firstInteractionIdx && !demoStarted) ||
    (requiresAnalyzed && index === analyzedIdx && !demoAnalyzed) ||
    (requiresInteraction && index === secondInteractionIdx && !demoCompleted);

  const nextBtnRef = React.useRef<HTMLButtonElement>(null);
  const backBtnRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !isNextDisabled) {
        nextBtnRef.current?.click();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        backBtnRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNextDisabled, index]);

  return (
    <div
      {...tooltipProps}
      className="bg-white dark:bg-darkModeTable border border-divider dark:border-darkModeCompliment rounded-lg shadow-xl p-5 w-80"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        {step.title && (
          <p className="text-base font-semibold dark:text-darkModeLight">{step.title as string}</p>
        )}
        <button
          {...closeProps}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-base leading-none"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <p className="text-[13px] text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
        {step.content as string}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {index + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              ref={backBtnRef}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 transition-colors"
            >
              Back
            </button>
          )}
          {!isLastStep && (
            <button
              {...skipProps}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 transition-colors"
            >
              Skip
            </button>
          )}
          {continuous && (
            <button
              {...primaryProps}
              ref={nextBtnRef}
              disabled={isNextDisabled}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                isNextDisabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-darkModeHover dark:text-gray-500'
                  : 'bg-[#F45513] text-white hover:bg-[#d94410] cursor-pointer'
              }`}
            >
              {isLastStep ? 'Done' : isNextDisabled ? 'Try it →' : 'Next'}
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default OnboardingTour;
