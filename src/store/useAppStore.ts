import { create } from 'zustand';
import type { AppLanguage, ThemeMode } from '@/types';

interface AppState {
  initialized: boolean;
  sidebarOpen: boolean;
  tourOpen: boolean;
  theme: ThemeMode;
  language: AppLanguage;
  setInitialized: (value: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  setTourOpen: (open: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: AppLanguage) => void;
}

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  sidebarOpen: false,
  tourOpen: false,
  theme: 'system',
  language: 'en',
  setInitialized: (initialized) => set({ initialized }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setTourOpen: (tourOpen) => set({ tourOpen }),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
