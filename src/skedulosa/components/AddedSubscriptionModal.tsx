import { useNavigate } from 'react-router-dom';
import BaseModal from '@/downlodr/components/modal/BaseModal';

const AddedSubscriptionModal = ({
  isOpen,
  onClose,
  channelName,
  channelId,
}: {
  isOpen: boolean;
  onClose: () => void;
  channelName?: string;
  channelId?: string;
}) => {
  const navigate = useNavigate();
  const displayName = channelName?.trim() || 'your channel';

  const handleViewSubscription = () => {
    console.log('Navigating to subscription details for channelId:', channelId);
    if (channelId) {
      navigate(`/skedulosa/selected-subscription/${channelId}`);
    } else {
      navigate('/skedulosa/subscription');
    }
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-[450px]"
      footer={
        <div className="flex items-center justify-center gap-2 py-2 pb-2">
          <button
            type="button"
            onClick={handleViewSubscription}
            className="bg-primary px-2.5 py-1.5 rounded-md text-white font-bold hover:opacity-90 dark:hover:opacity-75"
          >
            View Subscription
          </button>
        </div>
      }
    >
      <div className="flex flex-col text-center items-center justify-center -mt-4">
        <h1 className="text-lg font-bold mb-2">
          Subscription Created Successfully!
        </h1>
        <div className="text-[13px] mt-1">
          <span>You’re now subscribed to </span>
          <span className="font-semibold">{displayName}. </span>
          <p className="mx-3">
            Sit back and let us handle the rest—your videos will be downloaded
            at the set time.
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default AddedSubscriptionModal;
