import React, { useEffect, useRef, useState } from 'react';
import { FaRegCheckCircle, FaRegClock } from 'react-icons/fa';
import { LiaQuestionCircle } from 'react-icons/lia';
import { LuGlobe } from 'react-icons/lu';
import { VscClose } from 'react-icons/vsc';
import {
  DUMMY_CHANNEL,
  DUMMY_CHANNEL_URL,
  DUMMY_SUBSCRIPTION_URL,
} from '../../types/onboardingTypes';

interface DemoSubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  onAnalyzed?: () => void;
  variant: 'youtube' | 'website';
}

const DemoSubscribeModal: React.FC<DemoSubscribeModalProps> = ({
  isOpen,
  onClose,
  onSubscribe,
  onAnalyzed,
  variant,
}) => {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [selectedFrequency, setSelectedFrequency] = useState<'auto' | 'manual'>('auto');
  const inputRef = useRef<HTMLInputElement>(null);

  const placeholder = variant === 'youtube' ? DUMMY_CHANNEL_URL : DUMMY_SUBSCRIPTION_URL;
  const websiteDomain = DUMMY_SUBSCRIPTION_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setAnalyzing(false);
      setAnalyzed(false);
      setSelectedFrequency('auto');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Simulate analysis 800ms after the user stops typing
  useEffect(() => {
    if (!url.trim()) {
      setAnalyzing(false);
      setAnalyzed(false);
      return;
    }
    setAnalyzing(true);
    setAnalyzed(false);
    const t = setTimeout(() => {
      setAnalyzing(false);
      setAnalyzed(true);
      onAnalyzed?.();
    }, 800);
    return () => clearTimeout(t);
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSubscribe = () => {
    onSubscribe();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeTable rounded-xl shadow-2xl w-full max-w-[530px] max-h-[90vh] overflow-hidden flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-darkModeTableBorder flex-shrink-0">
          <h2 className="text-sm font-semibold dark:text-gray-100">Subscribe</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <VscClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* URL / Channel name input */}
          {analyzed ? (
            <>
              {variant === 'youtube' && (
                <>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    Channel Name
                  </label>
                  <input
                    type="text"
                    defaultValue={DUMMY_CHANNEL.name}
                    className="mt-1 w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 text-xs"
                  />
                </>
              )}
            </>
          ) : (
            <>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Source URL
              </label>
              <div id="demo-modal-url-input">
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onClick={() => { if (!url.trim()) setUrl(placeholder); }}
                  placeholder={placeholder}
                  className="mt-1 w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md h-8 text-xs cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-1 mt-2 text-gray-500 dark:text-gray-400 cursor-default w-fit">
                <LiaQuestionCircle size={15} />
                <span className="text-[12px]">What can I subscribe to?</span>
              </div>
              {analyzing && (
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="animate-spin text-primary text-base leading-none">⟳</span>
                  Analyzing…
                </div>
              )}
            </>
          )}

          {/* YouTube channel info card */}
          {analyzed && variant === 'youtube' && (
            <div id="demo-channel-card" className="mt-4 flex items-center justify-between gap-2 bg-[#0000000D] dark:bg-white/5 p-2 rounded-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{DUMMY_CHANNEL.name[0]}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <h1 className="font-semibold text-sm dark:text-gray-100">{DUMMY_CHANNEL.name}</h1>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                    <span>YouTube Channel</span>
                    <span>•</span>
                    <span>4.8K subscribers</span>
                    <span>•</span>
                    <span>{DUMMY_CHANNEL.videos.length} videos</span>
                  </div>
                  <div className="flex flex-row gap-1 items-center mt-0.5">
                    <span className="text-[#818181] text-xs">Download last</span>
                    <select className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-1.5 text-xs text-[#474747] dark:text-gray-100">
                      <option>1</option>
                      <option>2</option>
                      <option>3</option>
                    </select>
                    <span className="text-[#818181] text-xs">videos</span>
                  </div>
                </div>
              </div>
              <div className="p-4 flex-shrink-0">
                <FaRegCheckCircle size={16} className="text-green-500" />
              </div>
            </div>
          )}

          {/* Website info card */}
          {analyzed && variant === 'website' && (
            <div className="mt-4 flex items-center gap-3 bg-[#0000000D] dark:bg-white/5 p-3 rounded-md">
              <LuGlobe size={20} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm dark:text-gray-100 truncate">{websiteDomain}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Website — select sections in the next step
                </p>
              </div>
              <FaRegCheckCircle size={16} className="text-green-500 flex-shrink-0" />
            </div>
          )}

          {/* Frequency config — YouTube only */}
          {analyzed && variant === 'youtube' && (
            <div className="mt-4 py-3 px-1 border-t-2 border-slate-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400 text-xs">Basic configuration</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <label className="text-xs text-gray-500 dark:text-gray-400">Check frequency</label>
                <div className="flex items-center bg-gray-100 dark:bg-darkModeCompliment rounded-md p-0.5 gap-0.5">
                  {(['auto', 'manual'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedFrequency(opt)}
                      className={`px-4 py-1 text-xs font-medium rounded transition-all capitalize ${
                        selectedFrequency === opt
                          ? 'bg-white dark:bg-darkMode text-primary shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      {opt === 'auto' ? 'Auto' : 'Manual'}
                    </button>
                  ))}
                </div>
              </div>

              {selectedFrequency === 'auto' && (
                <div className="px-1 mt-3">
                  <div className="flex items-center justify-between border border-primary/20 rounded-xl py-1 pl-2 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-primary text-sm">📈</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm dark:text-gray-100">{DUMMY_CHANNEL.name}</p>
                        <p className="text-[11.5px] text-gray-500 dark:text-gray-400">
                          Based on {DUMMY_CHANNEL.videos.length} videos
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold text-primary">Weekly Uploader</p>
                  </div>
                  <div className="mt-2 px-1">
                    <span className="text-gray-500 dark:text-gray-400 text-[11.5px]">Using frequency </span>
                    <span className="text-[11.5px] font-semibold text-primary">Weekly.</span>
                    <span className="text-[11.5px] text-gray-500 dark:text-gray-400"> Confidence: 91%</span>
                  </div>
                </div>
              )}

              {selectedFrequency === 'manual' && (
                <div className="mt-3 flex items-center gap-1.5 border border-primary/50 rounded-md p-2">
                  <FaRegClock className="text-primary flex-shrink-0" size={13} />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scheduled every{' '}
                    <span className="font-bold">Sunday</span> at{' '}
                    <span className="font-bold">06:00</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-darkModeTableBorder px-5 py-3">
          <div className="flex items-center justify-center gap-2 w-full">
            <button
              onClick={onClose}
              className="flex-1 max-w-[180px] bg-[#F3F3F3] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-200 py-1.5 rounded-md text-sm cursor-pointer hover:opacity-90"
            >
              Cancel
            </button>
            <button
              id="demo-subscribe-confirm"
              onClick={handleSubscribe}
              disabled={!analyzed}
              className={`flex-1 max-w-[296px] text-white py-1.5 rounded-md text-sm transition-opacity ${
                analyzed
                  ? 'bg-primary hover:opacity-90 cursor-pointer'
                  : 'bg-primary/50 cursor-not-allowed'
              }`}
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoSubscribeModal;
