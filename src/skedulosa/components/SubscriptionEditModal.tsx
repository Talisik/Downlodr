import AfdaEditWebsiteModal from '@/afda/components/AfdaEditWebsiteModal';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import SkedulosaEditModal from '@/skedulosa/components/SkedulosaEditModal';

export interface SubscriptionEditTarget {
  id: string;
  category: string;
}

interface SubscriptionEditModalProps {
  target: SubscriptionEditTarget;
  onClose: () => void;
}

/**
 * Opens the right edit modal for a row in the merged subscriptions list.
 * Routes by category, never by id alone: scheduledChannels and afdaWebsites
 * use integer IDs from separate databases that can collide, and handing an
 * AFDA id to SkedulosaEditModal either opens a blank form or edits the
 * YouTube subscription that happens to share the id.
 */
const SubscriptionEditModal = ({
  target,
  onClose,
}: SubscriptionEditModalProps) => {
  const isAfda = target.category === 'afda-website';
  const website = useAfdaWebsitesStore((s) =>
    isAfda ? s.websites.find((w) => w.id === target.id) : undefined,
  );

  if (isAfda) {
    // Website not loaded yet (worker still starting) or already deleted.
    if (!website) return null;
    return <AfdaEditWebsiteModal isOpen onClose={onClose} website={website} />;
  }

  return (
    <SkedulosaEditModal isOpen onClose={onClose} subscriptionId={target.id} />
  );
};

export default SubscriptionEditModal;
