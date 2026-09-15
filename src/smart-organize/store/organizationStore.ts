import { createIndexedDBStorageWithMigration } from '@/core-app/utils/indexedDBStorage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// ---- IndexedDB helper ----
const dbName = 'organizationStoreDB';
const storeName = 'organizationData';
const version = 2;

interface OrganizationData {
  groups: Record<string, { video_id: string; video_title: string }[]>;
  category_contexts: Record<string, string>;
  timestamp: number;
}

interface OrganizationStore {
  usage: number;
  organizationData: OrganizationData | null;
  incrementUsage: (amount?: number) => void;
  resetUsage: () => void;
  setOrganizationData: (data: OrganizationData) => void;
  clearOrganizationData: () => void;
}

// Migration function to preserve data during version upgrades
const migrateOrganizationStore = (
  persistedState: unknown,
  persistedVersion: number,
): Partial<OrganizationStore> => {
  console.log(
    `Migrating organizationStore from version ${persistedVersion} to ${version}`,
  );

  // If no version exists or version is 0, return default state
  if (persistedVersion === undefined || persistedVersion === 0) {
    return {
      usage: 1,
      organizationData: null,
    };
  }

  // Migration from version 1 to 2: preserve all data
  if (persistedVersion === 1) {
    const state = persistedState as Partial<OrganizationStore>;
    return {
      usage: typeof state?.usage === 'number' ? state.usage : 1,
      organizationData: state?.organizationData || null,
    };
  }

  // For current or future versions, return as-is
  return (
    (persistedState as Partial<OrganizationStore>) || {
      usage: 1,
      organizationData: null,
    }
  );
};

export const useOrganizationStore = create<OrganizationStore>()(
  persist(
    (set) => ({
      usage: 1,
      organizationData: null as OrganizationData | null,

      incrementUsage: (amount = 1) => {
        set((state) => ({
          usage: state.usage + amount,
        }));
      },

      resetUsage: () => {
        set({ usage: 0 });
      },

      setOrganizationData: (data) => {
        set({
          organizationData: {
            groups: data.groups,
            category_contexts: data.category_contexts,
            timestamp: Date.now(),
          },
        });
      },

      clearOrganizationData: () => {
        set({ organizationData: null });
      },
    }),
    {
      name: 'organization-usage',
      version: version,
      migrate: migrateOrganizationStore,
      storage: createJSONStorage(() =>
        createIndexedDBStorageWithMigration({ dbName, storeName, version }),
      ),
    },
  ),
);
