"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ThemeMode = "dark" | "light";
type DashboardTab = "schedules" | "bookings" | "sessions" | "profile";

type UIState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  dashboardTab: DashboardTab;
  setDashboardTab: (tab: DashboardTab) => void;
  avatarRefreshToken: number;
  bumpAvatarRefreshToken: () => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      dashboardTab: "schedules",
      setDashboardTab: (tab) => set({ dashboardTab: tab }),
      avatarRefreshToken: 0,
      bumpAvatarRefreshToken: () => set((s) => ({ avatarRefreshToken: s.avatarRefreshToken + 1 })),
    }),
    {
      name: "bookhub-ui",
      partialize: (state) => ({
        theme: state.theme,
        dashboardTab: state.dashboardTab,
      }),
    },
  ),
);

