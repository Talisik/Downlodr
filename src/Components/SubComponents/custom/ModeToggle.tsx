/**
 * A custom React component
 * A React component that toggles between light and dark themes.
 * It displays a button with icons for light and dark modes.
 *
 * @returns JSX.Element - The rendered mode toggle component.
 */
import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../ThemeProvider';
import { Button } from '../shadcn/components/ui/button';

export function ModeToggle() {
  const { setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // use effect to close dropdown on window blur
  useEffect(() => {
    const handleWindowBlur = () => {
      setIsOpen(false);
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
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
        className="hover:bg-gray-100 dark:bg-transparent dark:hover:bg-darkModeCompliment hover:opacity-100 active:bg-transparent focus-none p-1 m-2 h-auto min-h-0"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Sun className="h-[1rem] w-[1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 bg-transparent" />
        <Moon className="absolute h-[1rem] w-[1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 bg-transparent" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      {isOpen && (
        <div className="fixed right-[inherit] w-32 rounded-md bg-white dark:bg-darkModeCompliment shadow-lg ring-1 ring-black ring-opacity-5 z-[100]">
          <div className="py-1" role="menu">
            <button
              className="block w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
            >
              Light
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
            >
              Dark
            </button>
            <button
              className="block w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
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
