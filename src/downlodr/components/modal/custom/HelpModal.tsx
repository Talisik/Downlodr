/**
 * A custom React component
 * Shows the Help modal for Downlodr, provides guide for using the Downlodr app as well as answers for commonly asked questions
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying the Help modal
 *
 */

import React, { useEffect, useRef, useState } from 'react';
import { IoChevronDownOutline } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useNavigate } from 'react-router-dom';
import BaseModal from '../BaseModal';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Accordion params and component
interface AccordionSectionProps {
  title: string;
  content: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  content,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = contentRef.current;
    if (!el) return;

    if (!isOpen) {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.3, ease: 'power2.out' },
      );
      gsap.to(chevronRef.current, { rotation: 180, duration: 0.25, ease: 'power2.out' });
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.in' });
      gsap.to(chevronRef.current, { rotation: 0, duration: 0.25, ease: 'power2.in' });
    }

    setIsOpen(!isOpen);
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-darkModeHover/50 transition-colors"
      >
        <span className="text-md dark:text-gray-300">{title}</span>
        <IoChevronDownOutline
          ref={chevronRef}
          className="dark:text-gray-300"
          style={{ transformOrigin: 'center' }}
        />
      </button>
      <div
        ref={contentRef}
        className="overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        <div className="px-4 pb-4 pt-1">
          {content}
        </div>
      </div>
    </div>
  );
};

// Help Modal
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('downlodr');
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('guide');

  const handleTabChange = (tabValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tabValue);
  };

  useEffect(() => {
    if (isOpen) {
      const defaultTab = location.pathname.includes('common')
        ? 'common'
        : location.pathname.includes('advanced')
        ? 'advanced'
        : 'guide';
      setActiveTab(defaultTab);
    }
  }, [isOpen]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('helpModal.title')}
      width="max-w-2xl"
      contentClassName="p-6 max-h-[70vh] overflow-y-auto space-y-6 dark:bg-darkMode"
    >
      <div className="space-y-6 -mt-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-divider dark:border-gray-700">
          <div>
            <p className="text-sm font-medium dark:text-gray-200">
              Interactive Tour
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              See every feature in action with a guided demo
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              navigate('/onboarding');
            }}
            className="flex-shrink-0 px-4 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            Take a Tour
          </button>
        </div>
        {/* Custom Tab Implementation */}
        <div className="w-full dark:bg-darkMode ">
          {/* Tab List */}
          <div className="dark:bg-darkModeBorderColor inline-flex h-8 items-center justify-center rounded-lg bg-tabs p-1 text-gray-500 dark:text-gray-400">
            <button
              onClick={(e) => handleTabChange('guide', e)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                activeTab === 'guide'
                  ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-xs dark:text-gray-50'
                  : 'dark:text-gray-300'
              }`}
            >
              {t('helpModal.tabs.guide')}
            </button>
            <button
              onClick={(e) => handleTabChange('common', e)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                activeTab === 'common'
                  ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-xs  dark:text-gray-50'
                  : 'dark:text-gray-300'
              }`}
            >
              {t('helpModal.tabs.common')}
            </button>
            <button
              onClick={(e) => handleTabChange('advanced', e)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                activeTab === 'advanced'
                  ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-xs  dark:text-gray-50'
                  : 'dark:text-gray-300'
              }`}
            >
              {t('helpModal.tabs.advanced')}
            </button>
            <button
              onClick={(e) => handleTabChange('subscription', e)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                activeTab === 'subscription'
                  ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-xs  dark:text-gray-50'
                  : 'dark:text-gray-300'
              }`}
            >
              {t('helpModal.tabs.subscription')}
            </button>
            <button
              onClick={(e) => handleTabChange('afda', e)}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                activeTab === 'afda'
                  ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-xs  dark:text-gray-50'
                  : 'dark:text-gray-300'
              }`}
            >
              {'Article Fetcher'}
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'guide' && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.guide.downloadSteps.title')}
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.guide.downloadSteps.s1')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s2')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s3')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s4')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s5')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s6')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s7')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s8')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.guide.downloadSteps.s8a')}</li>
                          <li>{t('helpModal.guide.downloadSteps.s8b')}</li>
                          <li>{t('helpModal.guide.downloadSteps.s8c')}</li>
                          <li>{t('helpModal.guide.downloadSteps.s8d')}</li>
                        </ul>
                        <li>{t('helpModal.guide.downloadSteps.s9')}</li>
                        <li>{t('helpModal.guide.downloadSteps.s10')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.guide.pauseStop.title')}
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.guide.pauseStop.s1')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.guide.pauseStop.s1a')}</li>
                          <li>{t('helpModal.guide.pauseStop.s1b')}</li>
                          <li>{t('helpModal.guide.pauseStop.s1c')}</li>
                        </ul>
                        <li>{t('helpModal.guide.pauseStop.s2')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.guide.pauseStop.s2a')}</li>
                          <li>{t('helpModal.guide.pauseStop.s2b')}</li>
                        </ul>
                        <li>{t('helpModal.guide.pauseStop.s3')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.guide.pauseStop.s3a')}</li>
                          <li>{t('helpModal.guide.pauseStop.s3b')}</li>
                        </ul>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'common' && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.common.whatIsHistory.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.common.whatIsHistory.s1')}</li>
                        <li>{t('helpModal.common.whatIsHistory.s2')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.common.whatIsHistory.s2a')}</li>
                          <li>{t('helpModal.common.whatIsHistory.s2b')}</li>
                          <li>{t('helpModal.common.whatIsHistory.s2c')}</li>
                        </ul>
                        <li>{t('helpModal.common.whatIsHistory.s3')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.common.viewVideos.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.common.viewVideos.s1')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.common.contextMenus.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.common.contextMenus.s1')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.common.contextMenus.s1a')}</li>
                          <li>{t('helpModal.common.contextMenus.s1b')}</li>
                          <li>{t('helpModal.common.contextMenus.s1c')}</li>
                          <li>{t('helpModal.common.contextMenus.s1d')}</li>
                        </ul>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.advanced.stuckInitializing.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.advanced.stuckInitializing.s1')}</li>
                        <li>{t('helpModal.advanced.stuckInitializing.s2')}</li>
                        <li>
                          {t('helpModal.advanced.stuckInitializing.s3')}
                          <ul className="mt-2 list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                            <li>
                              {t('helpModal.advanced.stuckInitializing.s3a')}
                            </li>
                            <li>
                              {t('helpModal.advanced.stuckInitializing.s3b')}
                            </li>
                            <li>
                              {t('helpModal.advanced.stuckInitializing.s3c')}
                            </li>
                          </ul>
                        </li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.advanced.failedDelete.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.advanced.failedDelete.s1')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.advanced.failedDelete.s1a')}</li>
                          <li>{t('helpModal.advanced.failedDelete.s1b')}</li>
                          <li>{t('helpModal.advanced.failedDelete.s1c')}</li>
                        </ul>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.advanced.slowSpeed.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.advanced.slowSpeed.s1')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.advanced.slowSpeed.s1a')}</li>
                          <li>{t('helpModal.advanced.slowSpeed.s1b')}</li>
                          <li>{t('helpModal.advanced.slowSpeed.s1c')}</li>
                        </ul>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.advanced.permissionErrors.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.advanced.permissionErrors.s1')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>
                            {t('helpModal.advanced.permissionErrors.s1a')}
                          </li>
                          <li>
                            {t('helpModal.advanced.permissionErrors.s1b')}
                          </li>
                          <li>
                            {t('helpModal.advanced.permissionErrors.s1c')}
                          </li>
                        </ul>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'afda' && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.afda.whatIsAfda.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.afda.whatIsAfda.s1')}</li>
                        <li>{t('helpModal.afda.whatIsAfda.s2')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.afda.whatIsAfda.s2a')}</li>
                          <li>{t('helpModal.afda.whatIsAfda.s2b')}</li>
                        </ul>
                        <li>{t('helpModal.afda.whatIsAfda.s3')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.afda.singleArticle.title')}
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.afda.singleArticle.s1')}</li>
                        <li>{t('helpModal.afda.singleArticle.s2')}</li>
                        <li>{t('helpModal.afda.singleArticle.s3')}</li>
                        <li>{t('helpModal.afda.singleArticle.s4')}</li>
                        <li>{t('helpModal.afda.singleArticle.s5')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.afda.websiteSubscription.title')}
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.afda.websiteSubscription.s1')}</li>
                        <li>{t('helpModal.afda.websiteSubscription.s2')}</li>
                        <li>{t('helpModal.afda.websiteSubscription.s3')}</li>
                        <li>{t('helpModal.afda.websiteSubscription.s4')}</li>
                        <li>{t('helpModal.afda.websiteSubscription.s5')}</li>
                        <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-xs">
                          <li>{t('helpModal.afda.websiteSubscription.s5a')}</li>
                          <li>{t('helpModal.afda.websiteSubscription.s5b')}</li>
                          <li>{t('helpModal.afda.websiteSubscription.s5c')}</li>
                        </ul>
                        <li>{t('helpModal.afda.websiteSubscription.s6')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.afda.managingSubscriptions.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.afda.managingSubscriptions.s1')}</li>
                        <li>{t('helpModal.afda.managingSubscriptions.s2')}</li>
                        <li>{t('helpModal.afda.managingSubscriptions.s3')}</li>
                        <li>{t('helpModal.afda.managingSubscriptions.s4')}</li>
                        <li>{t('helpModal.afda.managingSubscriptions.s5')}</li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'subscription' && (
            <div className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.subscription.howToAdd.title')}
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>{t('helpModal.subscription.howToAdd.s1')}</li>
                        <li>{t('helpModal.subscription.howToAdd.s2')}</li>
                        <li>
                          {t('helpModal.subscription.howToAdd.s3')}
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>{t('helpModal.subscription.howToAdd.s3a')}</li>
                            <li>{t('helpModal.subscription.howToAdd.s3b')}</li>
                          </ul>
                        </li>
                        <li>{t('helpModal.subscription.howToAdd.s4')}</li>
                        <li>
                          {t('helpModal.subscription.howToAdd.s5')}
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>{t('helpModal.subscription.howToAdd.s5a')}</li>
                            <li>{t('helpModal.subscription.howToAdd.s5b')}</li>
                            <li>{t('helpModal.subscription.howToAdd.s5c')}</li>
                            <li>{t('helpModal.subscription.howToAdd.s5d')}</li>
                          </ul>
                        </li>
                        <li>{t('helpModal.subscription.howToAdd.s6')}</li>
                        <li>{t('helpModal.subscription.howToAdd.s7')}</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.subscription.whatHappensAfter.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s1')}
                        </li>
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s2')}
                        </li>
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s3')}
                        </li>
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s4')}
                        </li>
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s5')}
                        </li>
                        <li>
                          {t('helpModal.subscription.whatHappensAfter.s6')}
                        </li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  <AccordionSection
                    title={t('helpModal.subscription.commonErrors.title')}
                    content={
                      <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-xs">
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.invalidUrl.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.invalidUrl.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.invalidUrl.s2',
                              )}
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.unsupportedPlatform.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.unsupportedPlatform.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.unsupportedPlatform.s2',
                              )}
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.videoOrShorts.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.videoOrShorts.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.videoOrShorts.s2',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.videoOrShorts.s3',
                              )}
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.alreadySubscribed.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.alreadySubscribed.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.alreadySubscribed.s2',
                              )}
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.noVideos.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.noVideos.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.noVideos.s2',
                              )}
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>
                            {t(
                              'helpModal.subscription.commonErrors.analysisFailed.title',
                            )}
                          </strong>
                          <ul className="list-inside list-disc pl-4 space-y-1 mt-1 dark:text-gray-300 text-xs">
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.analysisFailed.s1',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.analysisFailed.s2',
                              )}
                            </li>
                            <li>
                              {t(
                                'helpModal.subscription.commonErrors.analysisFailed.s3',
                              )}
                            </li>
                          </ul>
                        </li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
};

export default HelpModal;
