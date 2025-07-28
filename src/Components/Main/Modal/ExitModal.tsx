import { useMainStore } from '@/Store/mainStore';
import { useEffect, useState } from 'react';
import { IoMdClose } from 'react-icons/io';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ExitModal = ({ isOpen, onClose, onConfirm }: ConfirmModalProps) => {
  const { settings, updateExitModal } = useMainStore();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset checkbox state when modal opens
      setDontShowAgain(false);
    }
  }, [isOpen]);

  const handleCancel = () => {
    onClose();
  };

  const handleContinue = () => {
    // If user checked "don't show again", update the setting
    if (dontShowAgain) {
      updateExitModal(false); // Disable showing the modal in the future
    }
    onConfirm();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment px-6 pt-5 max-w-[400px] w-full mx-4">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-[15px] font-semibold dark:text-darkModeLight">
            Downlodr will still run in the system tray
          </h1>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={16} />
          </button>
        </div>
        <p className="text-gray-800 dark:text-gray-200">
          The app will continue running in the background.
        </p>
        <p className="text-gray-800 dark:text-gray-200 mb-2">
          To fully exit, right-click the tray icon and select "Quit"
        </p>
        <p className="text-gray-800 dark:text-gray-200 mb-3">
          Tip: You can disable this in Settings - Application Behavior
        </p>
        <div className="flex items-center gap-2 mb-3">
          <input
            type="checkbox"
            id="dont-show-again"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="w-2 h-2 text-primary rounded focus:ring-primary"
          />
          <label
            htmlFor="dont-show-again"
            className="text-xs block dark:text-gray-200 font-medium cursor-pointer"
          >
            Don't show this message again
          </label>
        </div>
        <div className="bg-titleBar dark:bg-darkMode flex gap-3 justify-end -mx-6 px-4 py-2 rounded-b-md">
          <button
            onClick={handleContinue}
            className="px-2 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitModal;
