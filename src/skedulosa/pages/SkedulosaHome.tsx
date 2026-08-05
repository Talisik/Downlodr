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
import { useAfdaMapperStore } from '@/afda/store/afdaMapperStore';
import { extractFqdn } from '@/afda/utils/extractFqdn';
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
      // A stashed mapper result/error for this URL means an AFDA website run
      // finished while this page was unmounted ("Run in background") — resume
      // the website flow (section picker / error) instead of the subscribe modal.
      const { pendingResult, pendingError } = useAfdaMapperStore.getState();
      const fqdn = extractFqdn(pendingSubscribeUrl);
      if (
        fqdn &&
        (pendingResult?.fqdn === fqdn || pendingError?.fqdn === fqdn)
      ) {
        setFlowStep({ step: 'website', url: pendingSubscribeUrl });
        setPendingSubscribeUrl(null);
        return;
      }
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

export default SkedulosaHome;
