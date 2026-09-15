/**
 * A custom React component
 * Shows the About modal for Downlodr, displays features as well as link to official site
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying the About modal
 *
 */

import DownlodrLogo from '@/assets/logo/downlodr_icon.svg';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiExternalLink } from 'react-icons/fi';
import BaseModal from '../BaseModal';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('downlodr');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [ytdlpVersion, setYtdlpVersion] = useState<string | null>(null);

  useEffect(() => {
    const getVersion = async () => {
      if (window.updateAPI) {
        try {
          const currentVersion = await window.updateAPI.getCurrentVersion();
          if (currentVersion) {
            setAppVersion(currentVersion);
          }
        } catch (error) {
          console.error('Error getting version:', error);
        }
      }

      if (window.ytdlp) {
        try {
          const result = await window.ytdlp.getCurrentVersion();
          if (result?.success && result.version) {
            setYtdlpVersion(result.version);
          }
        } catch {
          // silently omit if unavailable
        }
      }
    };

    getVersion();
  }, []);

  const handleLink = async () => {
    await window.downlodrFunctions.openExternalLink('https://downlodr.com/');
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('modals.about.title')}
      width="max-w-md"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            {t('common:buttons.close')}
          </button>
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex flex-row items-start">
          <img src={DownlodrLogo} alt="Downlodr" className="h-[50px]" />

          <div className="flex flex-col ml-4 items-start">
            <h1 className="font-bold text-xl">Downlodr</h1>
            <div className="flex gap-1 items-center">
              <h1 className="font-bold text-[13px] text-[#BCBCBC]">
                {t('modals.about.version', { version: appVersion })}
              </h1>
              <h1>-</h1>
              {ytdlpVersion && (
                <h1 className="ml-0.5 text-[13px] text-[#BCBCBC]">
                  yt-dlp {ytdlpVersion}
                </h1>
              )}
            </div>
          </div>
        </div>
        <div>
          <label className="block dark:text-gray-200 mt-4 font-bold">
            {t('modals.about.developedForYou')}
          </label>
          <div className="flex gap-1 pt-1 items-start">
            <a
              onClick={() => handleLink()}
              className="text-[11px] text-primary underline cursor-pointer hover:text-primary/80"
              role="button"
            >
              {t('modals.about.visitSite')}{' '}
            </a>
            <FiExternalLink className="self-center" size={10} />
          </div>
        </div>
        <div className="flex gap-4 pt-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                {t('modals.about.features.title')}
              </label>
            </div>
            <h1 className="font-bold text-[13px]">
              {t('modals.about.features.downloadVideos.title')}
            </h1>
            <ul className="list-disc">
              <li className="text-xs ml-6">
                {t('modals.about.features.downloadVideos.item1')}
              </li>
              <li className="text-xs ml-6">
                {t('modals.about.features.downloadVideos.item2')}
              </li>
              <li className="text-xs ml-6">
                {t('modals.about.features.downloadVideos.item3')}
              </li>
              <li className="text-xs ml-6">
                {t('modals.about.features.downloadVideos.item4')}
              </li>
            </ul>
            <h1 className="font-bold text-[13px] mt-2">
              {t('modals.about.features.easyToUse.title')}
            </h1>
            <ul className="list-disc">
              <li className="text-xs ml-6">
                {t('modals.about.features.easyToUse.item1')}
              </li>
              <li className="text-xs ml-6">
                {t('modals.about.features.easyToUse.item2')}
              </li>
              <li className="text-xs ml-6">
                {t('modals.about.features.easyToUse.item3')}
              </li>
            </ul>
            <h1 className="font-bold text-[13px] mt-2">
              {t('modals.about.features.advancedMedia.title')}
            </h1>
            <ul className="list-disc">
              <li className="text-xs ml-6">
                {t('modals.about.features.advancedMedia.item1')}
              </li>
              <li className="text-xs ml-6 mb-2">
                {t('modals.about.features.advancedMedia.item2')}
              </li>
            </ul>
          </div>
        </div>
        {/* End of Download Location Name */}
      </div>
    </BaseModal>
  );
};

export default AboutModal;
