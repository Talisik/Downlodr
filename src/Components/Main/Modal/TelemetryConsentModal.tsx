import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '@/Store/mainStore';
import React, { useEffect, useState } from 'react';
import { FiExternalLink } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';

interface TelemetryConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TelemetryConsentModal: React.FC<TelemetryConsentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { updateTelemetryEnabled, updateTelemetryConsentShown } =
    useMainStore();

  const [appVersion, setAppVersion] = useState('1.0.0');

  // Get current app version on mount
  useEffect(() => {
    const getVersion = async () => {
      try {
        if (window.updateAPI) {
          const currentVersion = await window.updateAPI.getCurrentVersion();
          if (currentVersion) {
            setAppVersion(currentVersion);
          }
        }
      } catch (error) {
        console.error('Failed to get app version:', error);
      }
    };

    getVersion();
  }, []);

  const handleAccept = () => {
    updateTelemetryEnabled(true);
    updateTelemetryConsentShown(true);

    toast({
      title: 'Telemetry Enabled',
      description:
        'Thank you for helping improve Downlodr! You can change this setting anytime in application behavior.',
      duration: 4000,
    });

    onClose();
  };

  const handleDecline = () => {
    updateTelemetryEnabled(false);
    updateTelemetryConsentShown(true);

    toast({
      title: 'Telemetry Disabled',
      description:
        'No telemetry data will be collected. You can enable this later in settings.',
      duration: 4000,
    });

    onClose();
  };

  // Open Link
  const handleLink = async () => {
    await window.downlodrFunctions.openExternalLink(
      'https://downlodr.com/privacy-agreement',
    );
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center h-full z-[9999]">
      <div className="bg-white dark:bg-darkModeDropdown border border-gray-200 dark:border-gray-700 rounded-lg px-6 pt-5 max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold dark:text-gray-200">
              Welcome To Downlodr – {appVersion}
            </h2>
          </div>
          <button
            onClick={handleDecline}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={20} />
          </button>
        </div>
        <hr className="solid mb-4 -mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />
        {/* Content */}
        <div className="space-y-4 mb-4">
          <p className="text-[14px] font-semibold text-gray-700 dark:text-gray-300 leading-relaxed">
            Desktop app usage
          </p>

          <div className="space-y-2">
            <p className="text-[13px] text-gray-700 dark:text-gray-300">
              Our desktop app collects usage data to help Downlodr deliver and
              improve our product and your experience. By installing this app
              you agree to share this information with Downlodr.
            </p>
          </div>

          <p className="text-[13px] text-gray-700 dark:text-gray-300">
            You can opt-out at any time in your Settings.
          </p>
          <div className="flex gap-1 items-start flex-row">
            <a
              onClick={() => handleLink()}
              className="text-[13px] text-primary underline cursor-pointer hover:text-primary/80"
              role="button"
            >
              Privacy Agreement
            </a>
            <FiExternalLink className="self-center text-primary" size={10} />
          </div>
        </div>
        <hr className="solid mt-4 -mx-6 w-[calc(100%+48px)] border-t border-divider dark:border-gray-700" />

        {/* Buttons */}
        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 px-4 py-3 rounded-b-lg border-x border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleDecline}
            className="px-3 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            Disagree
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-3 py-1 bg-primary dark:bg-primary dark:text-darkModeLight  dark:hover:bg-primary/90 text-white rounded-md hover:bg-primary/90 cursor-pointer"
          >
            Agree
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelemetryConsentModal;
