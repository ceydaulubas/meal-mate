import { create } from 'zustand';

interface UiState {
  isNavigationOpen: boolean;
  setNavigationOpen: (isOpen: boolean) => void;
  toggleNavigation: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  isNavigationOpen: false,
  setNavigationOpen: (isNavigationOpen) => set({ isNavigationOpen }),
  toggleNavigation: () => set((state) => ({ isNavigationOpen: !state.isNavigationOpen })),
}));
