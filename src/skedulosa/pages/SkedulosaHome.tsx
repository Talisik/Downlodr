import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import AddedSubscriptionModal from '../components/AddedSubscriptionModal';
import SkedulosaSubscribeModal from '../components/SkedulosaSubscribeModal';
import SkedulosaTableTaskbar from '../components/table/SkedulosaTableTaskbar';
import { useSkedulosaStore } from '../store/skedulosaStore';
import NoSchedulePage from './NoSchedulePage';

const SkedulosaHome = () => {
  const navigate = useNavigate();
  const { scheduledChannels } = useSkedulosaStore();
  const pendingSubscribeUrl = useSkedulosaStore((s) => s.pendingSubscribeUrl);
  const setPendingSubscribeUrl = useSkedulosaStore(
    (s) => s.setPendingSubscribeUrl,
  );
  const [isAddedSubscriptionModalOpen, setIsAddedSubscriptionModalOpen] =
    useState(false);
  const [addedSubscriptionChannelName, setAddedSubscriptionChannelName] =
    useState('');
  const [addedSubscriptionId, setAddedSubscriptionId] = useState<
    string | undefined
  >(undefined);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [pendingInitialUrl, setPendingInitialUrl] = useState<
    string | undefined
  >(undefined);

  useEffect(() => {
    if (pendingSubscribeUrl) {
      setPendingInitialUrl(pendingSubscribeUrl);
      setIsPendingModalOpen(true);
      setPendingSubscribeUrl(null);
    }
  }, [pendingSubscribeUrl]);

  const handleSubscriptionCreated = (channelName: string, subscriptionId: string) => {
    setAddedSubscriptionChannelName(channelName);
    setAddedSubscriptionId(subscriptionId);
    setIsAddedSubscriptionModalOpen(true);
  };

  const handleCloseAddedSubscriptionModal = () => {
    setIsAddedSubscriptionModalOpen(false);
    setAddedSubscriptionId(undefined);
  };

  const handleClosePendingModal = () => {
    setIsPendingModalOpen(false);
    setPendingInitialUrl(undefined);
  };

  const pendingModal = (
    <SkedulosaSubscribeModal
      isOpen={isPendingModalOpen}
      onClose={handleClosePendingModal}
      onSubscriptionCreated={handleSubscriptionCreated}
      initialUrl={pendingInitialUrl}
    />
  );

  if (scheduledChannels.length === 0) {
    return (
      <>
        <NoSchedulePage onSubscriptionCreated={handleSubscriptionCreated} />
        <AddedSubscriptionModal
          isOpen={isAddedSubscriptionModalOpen}
          onClose={handleCloseAddedSubscriptionModal}
          channelName={addedSubscriptionChannelName}
          channelId={addedSubscriptionId}
        />
        {pendingModal}
      </>
    );
  }
  return (
    <>
      <div className="flex flex-col h-full px-4">
        <SkedulosaTableTaskbar
          onSubscriptionCreated={handleSubscriptionCreated}
        />
        <Outlet />
      </div>
      <AddedSubscriptionModal
        isOpen={isAddedSubscriptionModalOpen}
        onClose={handleCloseAddedSubscriptionModal}
        channelName={addedSubscriptionChannelName}
        channelId={addedSubscriptionId}
      />
      {pendingModal}
    </>
  );
};

export default SkedulosaHome;
