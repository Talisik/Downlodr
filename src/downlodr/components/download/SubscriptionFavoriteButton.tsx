/**
 * Heart toggle for a subscription group row (Skedulosa channel or AFDA
 * website). Favorites the subscription only, not the downloads inside it.
 */
import {
  favoriteSubscriptionKey,
  useFavoriteSubscriptionsStore,
  type FavoriteSubscriptionKind,
} from '@/downlodr/store/favoriteSubscriptionsStore';
import React from 'react';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

const SubscriptionFavoriteButton: React.FC<{
  kind: FavoriteSubscriptionKind;
  id: string;
}> = ({ kind, id }) => {
  const isFavorited = useFavoriteSubscriptionsStore((s) =>
    s.favorites.includes(favoriteSubscriptionKey(kind, id)),
  );
  const toggleFavoriteSubscription = useFavoriteSubscriptionsStore(
    (s) => s.toggleFavoriteSubscription,
  );

  return (
    <button
      onClick={(e) => {
        // The row itself navigates into the subscription.
        e.stopPropagation();
        toggleFavoriteSubscription(kind, id);
      }}
      className="p-1 hover:opacity-80 transition-opacity"
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      {isFavorited ? (
        <FaHeart size={14} className="text-red-400" />
      ) : (
        <FaRegHeart size={14} className="text-gray-400 dark:text-gray-500" />
      )}
    </button>
  );
};

export default SubscriptionFavoriteButton;
