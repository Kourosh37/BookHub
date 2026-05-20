import { create } from "zustand";

type LoginMode = "phone" | "password";

type LoginUIState = {
  mode: LoginMode;
  codeSent: boolean;
  showPassword: boolean;
  otpPhone: string;
  resendCooldown: number;
  setMode: (value: LoginMode) => void;
  setCodeSent: (value: boolean) => void;
  setShowPassword: (value: boolean | ((prev: boolean) => boolean)) => void;
  setOtpPhone: (value: string) => void;
  setResendCooldown: (value: number | ((prev: number) => number)) => void;
};

export const useLoginUIStore = create<LoginUIState>((set) => ({
  mode: "phone",
  codeSent: false,
  showPassword: false,
  otpPhone: "",
  resendCooldown: 0,
  setMode: (value) => set({ mode: value }),
  setCodeSent: (value) => set({ codeSent: value }),
  setShowPassword: (value) =>
    set((state) => ({
      showPassword: typeof value === "function" ? (value as (prev: boolean) => boolean)(state.showPassword) : value,
    })),
  setOtpPhone: (value) => set({ otpPhone: value }),
  setResendCooldown: (value) =>
    set((state) => ({
      resendCooldown: typeof value === "function" ? (value as (prev: number) => number)(state.resendCooldown) : value,
    })),
}));
