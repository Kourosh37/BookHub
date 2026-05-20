import { create } from "zustand";

type AvatarPreview = { url: string; name: string } | null;

type AdminPanelUIState = {
  usersQuery: string;
  usersPage: number;
  usersPageSize: number;
  avatarPreview: AvatarPreview;
  setUsersQuery: (value: string) => void;
  setUsersPage: (updater: number | ((prev: number) => number)) => void;
  setAvatarPreview: (value: AvatarPreview) => void;
};

export const useAdminPanelUIStore = create<AdminPanelUIState>((set) => ({
  usersQuery: "",
  usersPage: 1,
  usersPageSize: 20,
  avatarPreview: null,
  setUsersQuery: (value) => set({ usersQuery: value }),
  setUsersPage: (updater) =>
    set((state) => ({
      usersPage: typeof updater === "function" ? (updater as (prev: number) => number)(state.usersPage) : updater,
    })),
  setAvatarPreview: (value) => set({ avatarPreview: value }),
}));
