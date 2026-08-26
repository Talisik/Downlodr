/**
 * A custom React component
 * A React component that toggles between light and dark themes.
 * It displays a button with icons for light and dark modes.
 *
 * @returns JSX.Element - The rendered mode toggle component.
 */

import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../core-app/components/shadcn/components/ui/button';
import { useTheme } from '../../../core-app/components/ThemeProvider';
import { useDropdownAnimation } from '../../../core-app/hooks/animation/useDropdownAnimation';
import { useIconToggleAnimation } from '../../../core-app/hooks/animation/useIconToggleAnimation';

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { sunRef, moonRef } = useIconToggleAnimation(theme);
  const { ref: animRef, mounted } = useDropdownAnimation(isOpen);

  useEffect(() => {
    const handleWindowBlur = () => setIsOpen(false);
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="hover:bg-gray-100 dark:bg-transparent dark:hover:bg-darkModeCompliment hover:opacity-100 active:bg-transparent focus-none p-1 my-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="relative flex items-center justify-center h-4 w-4">
          <Sun
            ref={sunRef}
            className="absolute h-[1rem] w-[1rem] text-text-paragraph"
          />
          <Moon
            ref={moonRef}
            className="absolute h-[1rem] w-[1rem] text-text-paragraph"
          />
        </span>
        <span className="sr-only">Toggle theme</span>
      </Button>

      {mounted && (
        <div
          ref={animRef}
          className="absolute right-0 top-full mt-1 w-[85px] rounded-md bg-white dark:bg-darkModeCompliment shadow-lg ring-1 ring-black ring-opacity-5 z-[100]"
        >
          <div className="py-1 gap-1" role="menu">
            <button
              className="font-semibold rounded-md w-[80%] mx-2 block px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
            >
              Light
            </button>
            <button
              className="font-semibold rounded-md mx-2 block w-[80%] px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
            >
              Dark
            </button>
            <button
              className="font-semibold rounded-md mx-2 block w-[80%] px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('system');
                setIsOpen(false);
              }}
            >
              System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
