import React, { useEffect, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { DUMMY_SUBSCRIPTION_URL } from '../../types/onboardingTypes';

const DEMO_SECTIONS = [
  { id: 1, name: 'Latest', volume: 'Low' },
  { id: 2, name: 'Technology', volume: 'Low' },
  { id: 3, name: 'Business', volume: 'Medium' },
  { id: 4, name: 'Science', volume: 'Low' },
];

const AnalyzingIcon = () => (
  <div className="relative flex items-center justify-center w-28 h-28">
    {/* Floating particles */}
    <div className="absolute top-2 left-[52px] w-2 h-2 bg-primary rounded-sm animate-bounce" />
    <div className="absolute top-5 right-[38px] w-2.5 h-2.5 bg-primary rounded-sm animate-bounce [animation-delay:150ms]" />
    <div className="absolute top-3 left-[38px] w-1.5 h-1.5 bg-primary/70 rounded-sm animate-bounce [animation-delay:300ms]" />
    {/* Box body */}
    <div className="absolute bottom-4 w-14 h-10 bg-primary rounded-t-md" />
    {/* Box lid / trapezoid */}
    <div
      className="absolute bottom-[52px] w-16 h-4 bg-primary"
      style={{ clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)' }}
    />
    {/* Box opening (white stripe) */}
    <div className="absolute bottom-[50px] w-14 h-1 bg-white/60" />
  </div>
);

interface DemoAfdaSubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
}

const DemoAfdaSubscribeModal: React.FC<DemoAfdaSubscribeModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
}) => {
  const [step, setStep] = useState<'analyzing' | 'sections'>('analyzing');
  const [selectedSections, setSelectedSections] = useState<Set<number>>(
    new Set(DEMO_SECTIONS.map((s) => s.id)),
  );
  const [maxArticles, setMaxArticles] = useState('5');

  const websiteDomain = DUMMY_SUBSCRIPTION_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  useEffect(() => {
    if (!isOpen) return;
    setStep('analyzing');
    setSelectedSections(new Set(DEMO_SECTIONS.map((s) => s.id)));
    const t = setTimeout(() => setStep('sections'), 1500);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const toggleSection = (id: number) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        id="demo-afda-sections-modal"
        className="bg-white dark:bg-darkModeTable rounded-xl shadow-2xl w-full max-w-[530px] max-h-[90vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-darkModeTableBorder flex-shrink-0">
          <h2 className="text-sm font-semibold dark:text-gray-100">Subscribe to a source</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <VscClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'analyzing' ? (
            /* ── Analyzing state ── */
            <div className="flex flex-col items-center justify-center gap-2 py-10 px-5">
              <AnalyzingIcon />
              <div className="text-center mt-2">
                <p className="font-bold text-base dark:text-gray-100">Analyzing Article</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Discovering sections</p>
              </div>
            </div>
          ) : (
            /* ── Section selection state ── */
            <div className="p-5 flex flex-col gap-4">
              {/* Subscription Name */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Subscription Name
                </label>
                <input
                  type="text"
                  defaultValue={websiteDomain}
                  className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-3 py-2 rounded-md text-sm"
                />
              </div>

              {/* Max Articles */}
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Max Articles to Download
                </label>
                <select
                  value={maxArticles}
                  onChange={(e) => setMaxArticles(e.target.value)}
                  className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-3 py-2 rounded-md text-sm appearance-none cursor-pointer"
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={String(n)}>{n}</option>
                  ))}
                </select>
              </div>

              {/* Sections header */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSections.size === DEMO_SECTIONS.length}
                    onChange={() =>
                      setSelectedSections(
                        selectedSections.size === DEMO_SECTIONS.length
                          ? new Set()
                          : new Set(DEMO_SECTIONS.map((s) => s.id)),
                      )
                    }
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {DEMO_SECTIONS.length} sections detected
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-primary font-medium">
                    ({selectedSections.size}) Selected
                  </span>
                  <button
                    onClick={() => setSelectedSections(new Set(DEMO_SECTIONS.map((s) => s.id)))}
                    className="text-xs border border-gray-200 dark:border-darkModeTableBorder px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-darkModeHover"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedSections(new Set())}
                    className="text-xs border border-gray-200 dark:border-darkModeTableBorder px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-darkModeHover"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Section cards */}
              <div className="flex flex-col gap-3">
                {DEMO_SECTIONS.map((section) => (
                  <div
                    key={section.id}
                    className="border border-gray-100 dark:border-darkModeTableBorder rounded-lg overflow-hidden"
                  >
                    {/* Section header row */}
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white dark:bg-darkModeTable">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSections.has(section.id)}
                          onChange={() => toggleSection(section.id)}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="font-semibold text-sm dark:text-gray-100">
                          {section.name}
                        </span>
                      </label>
                      <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                        {section.volume}
                      </span>
                    </div>

                    {/* Basic config */}
                    <div className="bg-gray-50 dark:bg-darkModeDropdown px-3 py-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">
                        Basic Configuration
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 dark:text-gray-300">Check Frequency</span>
                        <div className="flex items-center bg-gray-200 dark:bg-darkModeCompliment rounded-md overflow-hidden">
                          <button className="px-3 py-1 text-xs font-medium bg-primary text-white">
                            Auto
                          </button>
                          <button className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                            Manual
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-primary mt-1.5">
                        Suggested Low Frequency (Every ~6 hours)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-darkModeTableBorder px-5 py-3">
          {step === 'analyzing' ? (
            <div className="flex items-center justify-center gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 max-w-[180px] bg-[#F3F3F3] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md text-sm cursor-pointer hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('sections')}
                className="flex-1 max-w-[296px] bg-primary text-white py-1.5 rounded-md text-sm cursor-pointer hover:opacity-90"
              >
                Run in background
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 max-w-[180px] bg-[#F3F3F3] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md text-sm cursor-pointer hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={onSubscribe}
                disabled={selectedSections.size === 0}
                className={`flex-1 max-w-[296px] text-white py-1.5 rounded-md text-sm transition-opacity ${
                  selectedSections.size > 0
                    ? 'bg-primary hover:opacity-90 cursor-pointer'
                    : 'bg-primary/50 cursor-not-allowed'
                }`}
              >
                Subscribe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoAfdaSubscribeModal;
