import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Subscription {
  id: string;
  expirationDate: Date;
}

interface SubscriptionStoreState {
  subscriptions: Subscription[];
  expirationDate: Date;
  addSubscription: (subscription: Subscription) => void;
  removeSubscription: (id: string) => void;
}

export const subscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set, get) => ({
      subscriptions: [] as Subscription[],
      expirationDate: new Date('2026-03-29'),

      getSubscriptions: () => {
        return get().subscriptions;
      },

      getExpirationDate: () => {
        return get().expirationDate;
      },

      addSubscription: (subscription: Subscription) => {
        set((state) => ({
          subscriptions: [...state.subscriptions, subscription],
        }));
      },

      removeSubscription: (id: string) => {
        set((state) => ({
          subscriptions: state.subscriptions.filter(
            (subscription) => subscription.id !== id,
          ),
        }));
      },
    }),
    {
      name: 'subscription-store',

      partialize: (state) => ({
        subscriptions: state.subscriptions,
      }),
    },
  ),
);
