import { create } from 'zustand';

type Store = {
  isSmartOrganizeSearchOpen: boolean;
  setIsSmartOrganizeSearchOpen: (open: boolean) => void;
};

export const useComponentTriggerStore = create<Store>((set) => ({
  isSmartOrganizeSearchOpen: false,
  setIsSmartOrganizeSearchOpen: (open) =>
    set({ isSmartOrganizeSearchOpen: open }),
}));
