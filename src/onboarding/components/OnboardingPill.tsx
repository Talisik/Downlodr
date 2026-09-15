import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import {
  FEATURE_LABELS,
  FEATURE_ORDER,
  OnboardingFeature,
} from '../types/onboardingTypes';

interface OnboardingPillProps {
  active: OnboardingFeature;
  visited: Set<OnboardingFeature>;
  onSelect: (f: OnboardingFeature) => void;
  onExit: () => void;
}

const OnboardingPill: React.FC<OnboardingPillProps> = ({
  active,
  visited,
  onSelect,
  onExit,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <motion.div
      id="onboarding-pill"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      ref={ref}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment shadow-xl">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {FEATURE_ORDER.map((f) => {
            const isActive = f === active;
            const isVisited = visited.has(f);
            return (
              <button
                key={f}
                onClick={() => onSelect(f)}
                title={FEATURE_LABELS[f]}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-3 h-3 bg-primary'
                    : isVisited
                    ? 'w-2 h-2 bg-primary/50'
                    : 'w-2 h-2 bg-gray-300 dark:bg-darkModeDarkGray'
                }`}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-divider dark:bg-darkModeCompliment" />

        {/* Feature dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium dark:text-darkModeLight text-gray-700 hover:text-primary dark:hover:text-primary transition-colors min-w-[160px] justify-between"
          >
            <span>{FEATURE_LABELS[active]}</span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 rounded-lg bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment shadow-lg py-1 z-10"
              >
                {FEATURE_ORDER.map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      onSelect(f);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-darkModeHover ${
                      f === active
                        ? 'text-primary font-medium'
                        : 'dark:text-darkModeLight text-gray-700'
                    }`}
                  >
                    {FEATURE_LABELS[f]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-divider dark:bg-darkModeCompliment" />

        {/* Exit */}
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-darkModeLight transition-colors"
          title="Exit tour"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
};

export default OnboardingPill;
