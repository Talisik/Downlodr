import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSkedulosaStore } from '../store/skedulosaStore';
import { useAfdaSubscriptionsStore } from '@/afda/store/afdaSubscriptionsStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';

const NO_SCHEDULE_PATH = '/skedulosa/no-schedule';
const UTILS_DEMO_PATH = '/skedulosa/utils-demo';
const SUBSCRIPTION_DOWNLOADS_PATH = '/skedulosa/subscription-downloads';

export default function SkedulosaRouteGuard() {
  const location = useLocation();
  const scheduledChannels = useSkedulosaStore(
    (state) => state.scheduledChannels,
  );
  const afdaSubscriptions = useAfdaSubscriptionsStore((s) => s.afdaSubscriptions);
  const afdaWebsites = useAfdaWebsitesStore((s) => s.websites);

  const hasNoSchedules =
    (!scheduledChannels || scheduledChannels.length === 0) &&
    afdaSubscriptions.length === 0 &&
    afdaWebsites.length === 0;
  const isNoScheduleRoute = location.pathname === NO_SCHEDULE_PATH;
  const isUtilsDemoRoute = location.pathname === UTILS_DEMO_PATH;
  const isSubscriptionDownloadsRoute =
    location.pathname === SUBSCRIPTION_DOWNLOADS_PATH;

  if (
    hasNoSchedules &&
    !isNoScheduleRoute &&
    !isUtilsDemoRoute &&
    !isSubscriptionDownloadsRoute
  ) {
    return (
      <Navigate to={NO_SCHEDULE_PATH} replace state={{ from: location }} />
    );
  }

  return <Outlet />;
}
