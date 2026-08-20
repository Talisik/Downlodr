/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays common header
 * actions such as opening the AI chat, add-ons manager, settings, and help.
 *
 * Note: bulk download actions (Remove/Stop/Start) live in Toolbar.tsx, not here.
 *
 * @param className - for UI of TaskBar
 * @returns JSX.Element - The rendered component displaying a TaskBar
 *
 */
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { useAddonStore } from '@/core-app/store/addonStore';
import AboutModal from '@/downlodr/components/modal/custom/AboutModal';
import HelpModal from '@/downlodr/components/modal/custom/HelpModal';
// import PluginTaskBarExtension from '@/plugins/components/PluginTaskBarExtension';
import PageNavigation from '@/downlodr/components/navigation/PageNavigation';
import React, { useEffect, useRef, useState } from 'react';
import { AiOutlineExclamationCircle } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import { FiBook } from 'react-icons/fi';
import { RxUpdate } from 'react-icons/rx';
import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import SettingsModal from '../modal/custom/SettingsModal';
import AddonManagerModal from '../modal/custom/AddonManagerModal';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  const { t } = useTranslation('downlodr');
  const { toast } = useToast();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const showAddonModal = useAddonStore((s) => s.isAddonManagerOpen);
  const setAddonManagerOpen = useAddonStore((s) => s.setAddonManagerOpen);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const helpMenuRef = useRef<HTMLDivElement>(null);
  const { ref: helpDropdownRef, mounted: helpDropdownMounted } =
    useDropdownAnimation(showHelpMenu);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        helpMenuRef.current &&
        !helpMenuRef.current.contains(event.target as Node)
      ) {
        setShowHelpMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCheckForUpdates = async () => {
    setShowHelpMenu(false);
    toast({
      title: t('dropdownBar.toast.checkingConnectionTitle'),
      description: t('dropdownBar.toast.checkingConnectionDesc'),
      duration: 5000,
    });
    const hasInternet =
      await window.downlodrFunctions.checkInternetConnection();

    if (!hasInternet) {
      toast({
        variant: 'destructive',
        title: t('dropdownBar.toast.noInternetTitle'),
        description: t('dropdownBar.toast.noInternetDesc'),
        duration: 5000,
        action: (
          <ToastAction
            altText="Retry connection check"
            onClick={handleCheckForUpdates}
          >
            {t('dropdownBar.toast.retry')}
          </ToastAction>
        ),
      });
      return;
    }

    toast({
      title: t('dropdownBar.toast.checkingUpdatesTitle'),
      description: t('dropdownBar.toast.checkingUpdatesDesc'),
      duration: 5000,
    });

    if (window.updateAPI?.checkForUpdates && hasInternet) {
      try {
        const result = await window.updateAPI.checkForUpdates();
        if (result.error) {
          toast({
            variant: 'destructive',
            title: t('dropdownBar.toast.updateCheckFailedTitle'),
            description: result.error,
            duration: 5000,
          });
        } else if (!result.hasUpdate) {
          toast({
            title: t('dropdownBar.toast.upToDateTitle'),
            description: t('dropdownBar.toast.upToDateDesc', {
              version: result.currentVersion,
            }),
            duration: 5000,
          });
        }
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('dropdownBar.toast.updateCheckFailedTitle'),
          description: t('dropdownBar.toast.updateCheckFailedDesc'),
          duration: 5000,
        });
        console.error('Error checking for updates:', error);
      }
    }
  };

  return (
    <div className="taskbar-container">
      <div className={cn('flex items-center justify-between', className)}>
        <div className="flex items-center h-full px-2 space-x-0 md:space-x-2">
          <div className="gap-1 flex mr-2">
            <PageNavigation
              onAddonRequired={() => setAddonManagerOpen(true)}
              isAddonModalOpen={showAddonModal}
            />
          </div>
        </div>

        <div className="pl-4 flex items-center w-full">
          <div className="flex-1 flex items-center justify-center mx-4">
            <div className="flex items-center rounded-lg px-3 py-1 max-w-md w-full"></div>
          </div>

          <div className="flex items-center justify-end">
            <button
              className="px-3 py-1 rounded font-semibold hover:bg-gray-100 dark:hover:bg-darkModeNavigation"
              onClick={(e) => {
                e.stopPropagation();
                setAddonManagerOpen(true);
              }}
            >
              Add-ons
            </button>
            <button
              className="px-3 py-1 rounded font-semibold hover:bg-gray-100 dark:hover:bg-darkModeNavigation "
              onClick={(e) => {
                e.stopPropagation();
                setShowSettingsModal(true);
              }}
            >
              {t('toolbar.settingsButton')}
            </button>
            <div className="relative" ref={helpMenuRef}>
              <button
                className={`px-3 py-1 hover:bg-gray-100 dark:hover:bg-darkModeNavigation rounded font-semibold ${
                  showHelpMenu ? 'bg-gray-100 dark:bg-darkModeNavigation' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHelpMenu((prev) => !prev);
                }}
              >
                {t('dropdownBar.menus.help')}
              </button>
              {helpDropdownMounted && (
                <div
                  ref={helpDropdownRef}
                  className="absolute right-0 mt-1 w-[125px] bg-white dark:bg-darkModeDropdown border dark:border-gray-700 rounded-md shadow-lg py-1 z-50"
                >
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHelpModal(true);
                        setShowHelpMenu(false);
                      }}
                    >
                      <FiBook size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.guide')}
                      </span>
                    </button>
                  </div>
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCheckForUpdates();
                      }}
                    >
                      <RxUpdate size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.appUpdates')}
                      </span>
                    </button>
                  </div>
                  <div className="mx-1">
                    <button
                      className="w-full text-left px-1 py-2 hover:bg-gray-100 dark:hover:bg-darkModeCompliment rounded-md flex items-center gap-2 font-semibold dark:text-gray-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAboutModal(true);
                        setShowHelpMenu(false);
                      }}
                    >
                      <AiOutlineExclamationCircle size={16} />
                      <span className="text-xs">
                        {t('dropdownBar.help.about')}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      <AddonManagerModal
        isOpen={showAddonModal}
        onClose={() => setAddonManagerOpen(false)}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />
      {/* <PluginTaskBarExtension /> */}
    </div>
  );
};

export default TaskBar;
