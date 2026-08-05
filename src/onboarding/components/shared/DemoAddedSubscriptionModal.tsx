import React, { useEffect } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { VscClose } from 'react-icons/vsc';
import { DUMMY_SUBSCRIPTION_URL } from '../../types/onboardingTypes';

interface DemoAddedSubscriptionModalProps {
  isOpen: boolean;
  onViewSubscription: () => void;
}

const DemoAddedSubscriptionModal: React.FC<DemoAddedSubscriptionModalProps> = ({
  isOpen,
  onViewSubscription,
}) => {
  const websiteDomain = DUMMY_SUBSCRIPTION_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onViewSubscription();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onViewSubscription]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-darkModeTable rounded-xl shadow-2xl w-full max-w-[480px] mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-darkModeTableBorder">
          <h2 className="text-sm font-semibold dark:text-gray-100">Subscription Added</h2>
          <button
            onClick={onViewSubscription}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
          >
            <VscClose size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
            <FaCheckCircle size={36} className="text-green-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
              Subscription Created Successfully!
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-[340px]">
              You're now subscribed to <span className="font-semibold text-gray-700 dark:text-gray-200">{websiteDomain}</span>. Sit back and let us handle the rest—your articles will be downloaded at the set time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center px-5 pb-5">
          <button
            onClick={onViewSubscription}
            className="px-6 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 cursor-pointer transition-opacity"
          >
            View Subscription
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoAddedSubscriptionModal;
