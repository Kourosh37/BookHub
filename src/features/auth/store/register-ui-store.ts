import { create } from "zustand";

type RegisterUIState = {
  codeSent: boolean;
  showPassword: boolean;
  showConfirmPassword: boolean;
  otpPhone: string;
  resendCooldown: number;
  setCodeSent: (value: boolean) => void;
  setShowPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowConfirmPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
  setOtpPhone: (value: string) => void;
  setResendCooldown: (value: number | ((prev: number) => number)) => void;
};

export const useRegisterUIStore = create<RegisterUIState>((set) => ({
  codeSent: false,
  showPassword: false,
  showConfirmPassword: false,
  otpPhone: "",
  resendCooldown: 0,
  setCodeSent: (value) => set({ codeSent: value }),
  setShowPassword: (value) =>
    set((state) => ({
      showPassword: typeof value === "function" ? (value as (prev: boolean) => boolean)(state.showPassword) : value,
    })),
  setShowConfirmPassword: (value) =>
    set((state) => ({
      showConfirmPassword:
        typeof value === "function" ? (value as (prev: boolean) => boolean)(state.showConfirmPassword) : value,
    })),
  setOtpPhone: (value) => set({ otpPhone: value }),
  setResendCooldown: (value) =>
    set((state) => ({
      resendCooldown: typeof value === "function" ? (value as (prev: number) => number)(state.resendCooldown) : value,
    })),
}));
