import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import AddedSubscriptionModal from '../components/AddedSubscriptionModal';
import SkedulosaSubscribeModal from '../components/SkedulosaSubscribeModal';
import SkedulosaTableTaskbar from '../components/table/SkedulosaTableTaskbar';
import { useSkedulosaStore } from '../store/skedulosaStore';
import { useAfdaSubscriptionsStore } from '@/afda/store/afdaSubscriptionsStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import NoSchedulePage from './NoSchedulePage';
import AfdaAddedSubscriptionModal from '@/afda/components/AfdaAddedSubscriptionModal';
import AfdaAddWebsiteModal from '@/afda/components/AfdaAddWebsiteModal';
import {
  useAddonStore,
  type AddonPackState,
  type PackName,
} from '@/core-app/store/addonStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';

type FlowStep =
  | { step: 'idle' }
  | { step: 'subscribe'; initialUrl?: string }
  | { step: 'website'; url: string }
  | { step: 'youtube-success'; name: string; id: string }
  | { step: 'website-success'; name: string; id: string };

const SkedulosaHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDetailView =
    location.pathname.includes('/skedulosa/selected-article') ||
    location.pathname.includes('/skedulosa/selected-subscription');
  const { scheduledChannels } = useSkedulosaStore();
  const afdaSubscriptions = useAfdaSubscriptionsStore(
    (s) => s.afdaSubscriptions,
  );
  const afdaWebsites = useAfdaWebsitesStore((s) => s.websites);
  const pendingSubscribeUrl = useSkedulosaStore((s) => s.pendingSubscribeUrl);
  const setPendingSubscribeUrl = useSkedulosaStore(
    (s) => s.setPendingSubscribeUrl,
  );

  const [flowStep, setFlowStep] = useState<FlowStep>({ step: 'idle' });

  const skedulosaAddonState = useAddonStore((s) => s.skedulosa);
  const afdaAddonState = useAddonStore((s) => s.afda);

  const pendingExtensionSubscribe = useSkedulosaStore(
    (s) => s.pendingExtensionSubscribe,
  );
  const setPendingExtensionSubscribe = useSkedulosaStore(
    (s) => s.setPendingExtensionSubscribe,
  );
  const [isPendingAutoSubscribe, setIsPendingAutoSubscribe] = useState(false);
  const setPendingExtensionDownload = useTaskbarDownloadStore(
    (s) => s.setPendingExtensionDownload,
  );

  useEffect(() => {
    if (pendingSubscribeUrl) {
      setFlowStep({ step: 'subscribe', initialUrl: pendingSubscribeUrl });
      setIsPendingAutoSubscribe(pendingExtensionSubscribe);
      setPendingExtensionSubscribe(false);
      setPendingSubscribeUrl(null);
    }
  }, [pendingSubscribeUrl]);

  // When the user is already on a skedulosa page, TaskbarInputField is not mounted
  // so the extension:download IPC event has no listener. Handle it directly here.
  useEffect(() => {
    const channelPattern =
      /^https:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+|channel\/[\w-]+)(?:\/[^?]*)?(?:\?.*)?$/;

    window.extensionDownloadBridge?.onDownload(
      ({ url, format_id, autoDownload }) => {
        if (autoDownload) {
          setPendingExtensionDownload({ url, format_id });
          navigate('/status/all');
          return;
        }
        if (channelPattern.test(url)) {
          setFlowStep({ step: 'subscribe', initialUrl: url });
          setIsPendingAutoSubscribe(true);
        }
      },
    );

    return () => {
      window.extensionDownloadBridge?.offDownload();
    };
  }, []);

  const openSubscribeFlow = (initialUrl?: string) => {
    setFlowStep({ step: 'subscribe', initialUrl });
  };

  const closeFlow = () => setFlowStep({ step: 'idle' });

  const handleSubscriptionCreated = (
    channelName: string,
    subscriptionId: string,
  ) => {
    if (isPendingAutoSubscribe) {
      setIsPendingAutoSubscribe(false);
      setFlowStep({ step: 'idle' });
      if (subscriptionId) {
        navigate(`/skedulosa/selected-subscription/${subscriptionId}`);
      } else {
        navigate('/skedulosa/subscription');
      }
    } else {
      setFlowStep({
        step: 'youtube-success',
        name: channelName,
        id: subscriptionId,
      });
    }
  };

  const handleWebsiteUrlReady = (url: string) => {
    setFlowStep({ step: 'website', url });
  };

  const handleWebsiteSaved = (name: string, id: string) => {
    setFlowStep({ step: 'website-success', name, id });
  };

  const handleViewYouTubeSubscription = () => {
    const id = flowStep.step === 'youtube-success' ? flowStep.id : undefined;
    setFlowStep({ step: 'idle' });
    if (id) {
      navigate(`/skedulosa/selected-subscription/${id}`);
    } else {
      navigate('/skedulosa/subscription');
    }

    //here
    if (!isPendingAutoSubscribe) {
      // setIsAddedSubscriptionModalOpen(true);
    }
  };

  const handleCloseYouTubeSuccess = () => {
    setFlowStep({ step: 'idle' });
    if (!location.pathname.includes('/skedulosa/selected-')) {
      navigate('/skedulosa/subscription');
    }
  };

  const handleViewWebsiteSubscription = () => {
    const id = flowStep.step === 'website-success' ? flowStep.id : undefined;
    setFlowStep({ step: 'idle' });
    if (id) {
      navigate(`/skedulosa/selected-article/${id}`);
    } else {
      navigate('/skedulosa/subscription');
    }
  };

  const handleCloseWebsiteSuccess = () => {
    //here
    setIsPendingAutoSubscribe(false);
    setFlowStep({ step: 'idle' });
    if (!location.pathname.includes('/skedulosa/selected-')) {
      navigate('/skedulosa/subscription');
    }
  };

  if (
    skedulosaAddonState.status !== 'ready' &&
    afdaAddonState.status !== 'ready'
  ) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-4">
          <div className="mb-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Required Add-ons
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Download the add-ons below to unlock these features.
            </p>
          </div>
          <AddOnCard
            packName="video-nemesis-toolkit"
            label="Subscriptions"
            description="YouTube channel scheduling and automated downloads."
            state={skedulosaAddonState}
          />
          <AddOnCard
            packName="afda-backend"
            label="Article Fetcher"
            description="Article scraping and automated downloads for websites."
            state={afdaAddonState}
          />
        </div>
      </div>
    );
  }

  if (
    scheduledChannels.length === 0 &&
    afdaSubscriptions.length === 0 &&
    afdaWebsites.length === 0
  ) {
    return (
      <>
        <NoSchedulePage onOpenSubscribe={openSubscribeFlow} />
        {/* All subscription flow modals — always rendered flat, visibility controlled by flowStep */}
        <SkedulosaSubscribeModal
          isOpen={flowStep.step === 'subscribe'}
          onClose={closeFlow}
          initialUrl={
            flowStep.step === 'subscribe' ? flowStep.initialUrl : undefined
          }
          onSubscriptionCreated={handleSubscriptionCreated}
          onWebsiteUrlReady={handleWebsiteUrlReady}
          autoSubscribe={isPendingAutoSubscribe}
        />
        <AfdaAddWebsiteModal
          isOpen={flowStep.step === 'website'}
          onClose={closeFlow}
          initialUrl={flowStep.step === 'website' ? flowStep.url : undefined}
          onSaved={handleWebsiteSaved}
        />
        <AddedSubscriptionModal
          isOpen={flowStep.step === 'youtube-success'}
          onClose={handleCloseYouTubeSuccess}
          channelName={flowStep.step === 'youtube-success' ? flowStep.name : ''}
          channelId={
            flowStep.step === 'youtube-success' ? flowStep.id : undefined
          }
          onViewSubscription={handleViewYouTubeSubscription}
        />
        <AfdaAddedSubscriptionModal
          isOpen={flowStep.step === 'website-success'}
          onClose={handleCloseWebsiteSuccess}
          websiteName={
            flowStep.step === 'website-success' ? flowStep.name : undefined
          }
          onViewSubscription={handleViewWebsiteSubscription}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full px-4">
        {!isDetailView && (
          <SkedulosaTableTaskbar onOpenSubscribe={openSubscribeFlow} />
        )}
        <Outlet />
      </div>
      {/* All subscription flow modals — always rendered flat, visibility controlled by flowStep */}
      <SkedulosaSubscribeModal
        isOpen={flowStep.step === 'subscribe'}
        onClose={closeFlow}
        initialUrl={
          flowStep.step === 'subscribe' ? flowStep.initialUrl : undefined
        }
        onSubscriptionCreated={handleSubscriptionCreated}
        onWebsiteUrlReady={handleWebsiteUrlReady}
        autoSubscribe={isPendingAutoSubscribe}
      />
      <AfdaAddWebsiteModal
        isOpen={flowStep.step === 'website'}
        onClose={closeFlow}
        initialUrl={flowStep.step === 'website' ? flowStep.url : undefined}
        onSaved={handleWebsiteSaved}
      />
      <AddedSubscriptionModal
        isOpen={flowStep.step === 'youtube-success'}
        onClose={handleCloseYouTubeSuccess}
        channelName={flowStep.step === 'youtube-success' ? flowStep.name : ''}
        channelId={
          flowStep.step === 'youtube-success' ? flowStep.id : undefined
        }
        onViewSubscription={handleViewYouTubeSubscription}
      />
      <AfdaAddedSubscriptionModal
        isOpen={flowStep.step === 'website-success'}
        onClose={handleCloseWebsiteSuccess}
        websiteName={
          flowStep.step === 'website-success' ? flowStep.name : undefined
        }
        onViewSubscription={handleViewWebsiteSubscription}
      />
    </>
  );
};

function AddOnCard({
  packName,
  label,
  description,
  state,
}: {
  packName: PackName;
  label: string;
  description: string;
  state: AddonPackState;
}) {
  const handleDownload = () => {
    window.addonBridge?.download(packName);
    useAddonStore
      .getState()
      .setPackState(packName, { status: 'downloading', progress: 0 });
  };

  const isReady = state.status === 'ready';
  const isDownloading = state.status === 'downloading';
  const isOutdated = state.status === 'outdated';

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-3 ${
        isReady
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {label}
            </span>
            {isReady && (
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                ✓ Installed
              </span>
            )}
            {isOutdated && (
              <span className="text-xs font-medium text-amber-500">
                Update available
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
        {!isReady && !isDownloading && (
          <button
            type="button"
            onClick={handleDownload}
            className="flex-shrink-0 px-3 py-1.5 rounded-md bg-primary hover:opacity-90 text-white text-xs font-semibold transition-opacity"
          >
            {isOutdated ? 'Update' : 'Download'}
          </button>
        )}
      </div>
      {isDownloading && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${state.progress ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400">
            {state.progress ?? 0}% — Downloading {label}…
          </span>
        </div>
      )}
    </div>
  );
}

export default SkedulosaHome;
