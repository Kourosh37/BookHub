import { create } from "zustand";

type PublicScheduleUIState = {
  selectedDate: string;
  selectedSlot: string;
  avatarPreviewOpen: boolean;
  bookingError: string;
  setSelectedDate: (value: string) => void;
  setSelectedSlot: (value: string) => void;
  setAvatarPreviewOpen: (value: boolean) => void;
  setBookingError: (value: string) => void;
};

export const usePublicScheduleUIStore = create<PublicScheduleUIState>((set) => ({
  selectedDate: "",
  selectedSlot: "",
  avatarPreviewOpen: false,
  bookingError: "",
  setSelectedDate: (value) => set({ selectedDate: value }),
  setSelectedSlot: (value) => set({ selectedSlot: value }),
  setAvatarPreviewOpen: (value) => set({ avatarPreviewOpen: value }),
  setBookingError: (value) => set({ bookingError: value }),
}));
