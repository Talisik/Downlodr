import { useAddonStore } from '@/core-app/store/addonStore';
import { usePluginStore } from '@/plugins/store/pluginStore';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';

interface PageNavigationProps {
  className?: string;
  onAddonRequired?: () => void;
  isAddonModalOpen?: boolean;
}

const PageNavigation: React.FC<PageNavigationProps> = ({
  className = '',
  onAddonRequired,
  isAddonModalOpen = false,
}) => {
  const { t } = useTranslation('navbar');
  const location = useLocation();

  const { updateIsOpenPluginSidebar } = usePluginStore();
  const afdaStatus = useAddonStore((s) => s.afda.status);
  const skedulosaStatus = useAddonStore((s) => s.skedulosa.status);
  const hasAnyAddonInstalled =
    afdaStatus === 'ready' || skedulosaStatus === 'ready';

  const handleClosePanel = () => {
    updateIsOpenPluginSidebar(false);
  };

  const handleSkedulosaClick = (e: React.MouseEvent) => {
    if (!hasAnyAddonInstalled) {
      e.preventDefault();
      onAddonRequired?.();
    } else {
      handleClosePanel();
    }
  };

  return (
    <div className="flex justify-between items-center w-full">
      <div className={`flex items-center ${className} gap-2`}>
        <NavLink
          to="/status"
          className={({ isActive }) =>
            `px-1 md:px-2 py-1 rounded flex gap-1 font-semibold whitespace-nowrap ${
              isActive &&
              !isAddonModalOpen &&
              !location.pathname.startsWith('/plugins') &&
              !location.pathname.startsWith('/skedulosa')
                ? 'bg-[#F5F5F5] dark:bg-[#412E26] text-[#F45513]'
                : 'hover:bg-gray-100 dark:hover:bg-darkModeNavigation dark:text-gray-200'
            }`
          }
          end={false}
        >
          <span>{t('downloads')}</span>
        </NavLink>
        <NavLink
          to="/plugins"
          className={({ isActive }) =>
            `px-3 py-1 rounded flex gap-1 font-semibold whitespace-nowrap ${
              isActive && !isAddonModalOpen
                ? 'bg-[#F5F5F5] dark:bg-[#412E26] text-[#F45513]'
                : 'hover:bg-gray-100 dark:hover:bg-darkModeNavigation dark:text-gray-200'
            }`
          }
          onClick={handleClosePanel}
        >
          <span>{t('plugins')}</span>
        </NavLink>
        <NavLink
          id="demo-subscriptions-nav"
          to="/skedulosa"
          className={({ isActive }) =>
            `px-3 py-1 rounded flex gap-1 font-semibold whitespace-nowrap ${
              isActive || isAddonModalOpen
                ? 'bg-[#F5F5F5] dark:bg-[#412E26] text-[#F45513]'
                : 'hover:bg-gray-100 dark:hover:bg-darkModeNavigation dark:text-gray-200'
            }`
          }
          onClick={handleSkedulosaClick}
        >
          <span>{t('skedulosa')}</span>
        </NavLink>
        {/* */}
      </div>
      {/*  
      {plugins.length > 0 && location.pathname.startsWith('/plugins') && (
        <div className="flex items-center">
          <Button
            variant="default"
            onClick={handleInstall}
            className="text-md bg-[#F45513] dark:bg-[#F45513] dark:text-white dark:hover:text-black dark:hover:bg-white font-normal px-4 py-1 h-7 ml-4"
            icon={<FaPlus size={11} />}
          >
            {t('addPlugin')}
          </Button>
        </div>
      )}
        */}
    </div>
  );
};

export default PageNavigation;
