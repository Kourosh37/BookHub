import { create } from "zustand";
import { defaultSmsPreferences, type SmsPreferences } from "@/lib/sms-preferences";

type Question = { label: string; type: "text" | "textarea"; required: boolean };
type Range = { startTime: string; endTime: string };
type DayItem = { date: string; ranges: Range[] };
type ProfileSectionKey = "username" | "avatar" | "password" | "delete";
type SettingsSectionKey = "sms";
type QrModalState = { schedule: any; url: string };

export type ListFilterState = {
  query: string;
  from: string;
  to: string;
  scheduleIds: string[];
  sort: "time-asc" | "time-desc" | "name-asc" | "name-desc";
};

type DashboardPageState = {
  selectedDates: string[];
  dayConfigs: DayItem[];
  questions: Question[];
  baseUrl: string;
  cancelTarget: any | null;
  cancelLoading: boolean;
  creatingSchedule: boolean;
  editingScheduleId: string | null;
  editingTitle: string;
  savingTitle: boolean;
  deleteScheduleTarget: any | null;
  deletingSchedule: boolean;
  showCreateFormMobile: boolean;
  isExportMenuOpen: boolean;
  createError: string;
  slotDurationMinutes: number;
  gapMinutesValue: number;
  scheduleTitle: string;
  profileUsername: string;
  profileLoading: boolean;
  smsPreferences: SmsPreferences;
  smsPreferencesSaving: boolean;
  smsPreferencesError: string;
  requestingPasswordOtp: boolean;
  passwordOtpCooldown: number;
  passwordCode: string;
  newPassword: string;
  confirmNewPassword: string;
  deleteCode: string;
  deleteOtpCooldown: number;
  requestingDeleteOtp: boolean;
  deletingAccount: boolean;
  avatarPreview: { url: string; name: string } | null;
  deleteAccountOpen: boolean;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  qrModal: QrModalState | null;
  qrDataUrl: string;
  exportingImage: boolean;
  exportingPdf: boolean;
  exportContext: { title: string; stamp: string; count: number };
  profileSections: Record<ProfileSectionKey, boolean>;
  settingsSections: Record<SettingsSectionKey, boolean>;
  bookingFilters: ListFilterState;
  bookingFilterDraft: ListFilterState;
  bookingFilterOpen: boolean;
  sessionFilters: ListFilterState;
  sessionFilterDraft: ListFilterState;
  sessionFilterOpen: boolean;
};

type DashboardPageActions = {
  setSelectedDates: (v: string[]) => void;
  setDayConfigs: (v: DayItem[] | ((p: DayItem[]) => DayItem[])) => void;
  setQuestions: (v: Question[] | ((p: Question[]) => Question[])) => void;
  setBaseUrl: (v: string) => void;
  setCancelTarget: (v: any | null) => void;
  setCancelLoading: (v: boolean) => void;
  setCreatingSchedule: (v: boolean) => void;
  setEditingScheduleId: (v: string | null) => void;
  setEditingTitle: (v: string) => void;
  setSavingTitle: (v: boolean) => void;
  setDeleteScheduleTarget: (v: any | null) => void;
  setDeletingSchedule: (v: boolean) => void;
  setShowCreateFormMobile: (v: boolean | ((p: boolean) => boolean)) => void;
  setIsExportMenuOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setCreateError: (v: string) => void;
  setSlotDurationMinutes: (v: number) => void;
  setGapMinutesValue: (v: number) => void;
  setScheduleTitle: (v: string) => void;
  setProfileUsername: (v: string) => void;
  setProfileLoading: (v: boolean) => void;
  setSmsPreferences: (v: SmsPreferences) => void;
  setSmsPreferencesSaving: (v: boolean) => void;
  setSmsPreferencesError: (v: string) => void;
  setRequestingPasswordOtp: (v: boolean) => void;
  setPasswordOtpCooldown: (v: number | ((p: number) => number)) => void;
  setPasswordCode: (v: string) => void;
  setNewPassword: (v: string) => void;
  setConfirmNewPassword: (v: string) => void;
  setDeleteCode: (v: string) => void;
  setDeleteOtpCooldown: (v: number | ((p: number) => number)) => void;
  setRequestingDeleteOtp: (v: boolean) => void;
  setDeletingAccount: (v: boolean) => void;
  setAvatarPreview: (v: { url: string; name: string } | null) => void;
  setDeleteAccountOpen: (v: boolean) => void;
  setShowNewPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  setShowConfirmPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  setQrModal: (v: QrModalState | null) => void;
  setQrDataUrl: (v: string) => void;
  setExportingImage: (v: boolean) => void;
  setExportingPdf: (v: boolean) => void;
  setExportContext: (v: { title: string; stamp: string; count: number }) => void;
  setProfileSections: (
    v: Record<ProfileSectionKey, boolean> | ((p: Record<ProfileSectionKey, boolean>) => Record<ProfileSectionKey, boolean>),
  ) => void;
  setSettingsSections: (
    v: Record<SettingsSectionKey, boolean> | ((p: Record<SettingsSectionKey, boolean>) => Record<SettingsSectionKey, boolean>),
  ) => void;
  setBookingFilters: (v: ListFilterState | ((p: ListFilterState) => ListFilterState)) => void;
  setBookingFilterDraft: (v: ListFilterState | ((p: ListFilterState) => ListFilterState)) => void;
  setBookingFilterOpen: (v: boolean) => void;
  setSessionFilters: (v: ListFilterState | ((p: ListFilterState) => ListFilterState)) => void;
  setSessionFilterDraft: (v: ListFilterState | ((p: ListFilterState) => ListFilterState)) => void;
  setSessionFilterOpen: (v: boolean) => void;
};

export const dashboardDefaultListFilters: ListFilterState = {
  query: "",
  from: "",
  to: "",
  scheduleIds: [],
  sort: "time-asc",
};

type Store = DashboardPageState & DashboardPageActions;

export const useDashboardPageStore = create<Store>((set) => ({
  selectedDates: [],
  dayConfigs: [],
  questions: [],
  baseUrl: "",
  cancelTarget: null,
  cancelLoading: false,
  creatingSchedule: false,
  editingScheduleId: null,
  editingTitle: "",
  savingTitle: false,
  deleteScheduleTarget: null,
  deletingSchedule: false,
  showCreateFormMobile: false,
  isExportMenuOpen: false,
  createError: "",
  slotDurationMinutes: 30,
  gapMinutesValue: 10,
  scheduleTitle: "",
  profileUsername: "",
  profileLoading: false,
  smsPreferences: defaultSmsPreferences,
  smsPreferencesSaving: false,
  smsPreferencesError: "",
  requestingPasswordOtp: false,
  passwordOtpCooldown: 0,
  passwordCode: "",
  newPassword: "",
  confirmNewPassword: "",
  deleteCode: "",
  deleteOtpCooldown: 0,
  requestingDeleteOtp: false,
  deletingAccount: false,
  avatarPreview: null,
  deleteAccountOpen: false,
  showNewPassword: false,
  showConfirmPassword: false,
  qrModal: null,
  qrDataUrl: "",
  exportingImage: false,
  exportingPdf: false,
  exportContext: { title: "", stamp: "", count: 0 },
  profileSections: { username: false, avatar: false, password: false, delete: false },
  settingsSections: { sms: false },
  bookingFilters: { ...dashboardDefaultListFilters },
  bookingFilterDraft: { ...dashboardDefaultListFilters },
  bookingFilterOpen: false,
  sessionFilters: { ...dashboardDefaultListFilters },
  sessionFilterDraft: { ...dashboardDefaultListFilters },
  sessionFilterOpen: false,

  setSelectedDates: (v) => set({ selectedDates: v }),
  setDayConfigs: (v) => set((s) => ({ dayConfigs: typeof v === "function" ? v(s.dayConfigs) : v })),
  setQuestions: (v) => set((s) => ({ questions: typeof v === "function" ? v(s.questions) : v })),
  setBaseUrl: (v) => set({ baseUrl: v }),
  setCancelTarget: (v) => set({ cancelTarget: v }),
  setCancelLoading: (v) => set({ cancelLoading: v }),
  setCreatingSchedule: (v) => set({ creatingSchedule: v }),
  setEditingScheduleId: (v) => set({ editingScheduleId: v }),
  setEditingTitle: (v) => set({ editingTitle: v }),
  setSavingTitle: (v) => set({ savingTitle: v }),
  setDeleteScheduleTarget: (v) => set({ deleteScheduleTarget: v }),
  setDeletingSchedule: (v) => set({ deletingSchedule: v }),
  setShowCreateFormMobile: (v) => set((s) => ({ showCreateFormMobile: typeof v === "function" ? v(s.showCreateFormMobile) : v })),
  setIsExportMenuOpen: (v) => set((s) => ({ isExportMenuOpen: typeof v === "function" ? v(s.isExportMenuOpen) : v })),
  setCreateError: (v) => set({ createError: v }),
  setSlotDurationMinutes: (v) => set({ slotDurationMinutes: v }),
  setGapMinutesValue: (v) => set({ gapMinutesValue: v }),
  setScheduleTitle: (v) => set({ scheduleTitle: v }),
  setProfileUsername: (v) => set({ profileUsername: v }),
  setProfileLoading: (v) => set({ profileLoading: v }),
  setSmsPreferences: (v) => set({ smsPreferences: v }),
  setSmsPreferencesSaving: (v) => set({ smsPreferencesSaving: v }),
  setSmsPreferencesError: (v) => set({ smsPreferencesError: v }),
  setRequestingPasswordOtp: (v) => set({ requestingPasswordOtp: v }),
  setPasswordOtpCooldown: (v) => set((s) => ({ passwordOtpCooldown: typeof v === "function" ? v(s.passwordOtpCooldown) : v })),
  setPasswordCode: (v) => set({ passwordCode: v }),
  setNewPassword: (v) => set({ newPassword: v }),
  setConfirmNewPassword: (v) => set({ confirmNewPassword: v }),
  setDeleteCode: (v) => set({ deleteCode: v }),
  setDeleteOtpCooldown: (v) => set((s) => ({ deleteOtpCooldown: typeof v === "function" ? v(s.deleteOtpCooldown) : v })),
  setRequestingDeleteOtp: (v) => set({ requestingDeleteOtp: v }),
  setDeletingAccount: (v) => set({ deletingAccount: v }),
  setAvatarPreview: (v) => set({ avatarPreview: v }),
  setDeleteAccountOpen: (v) => set({ deleteAccountOpen: v }),
  setShowNewPassword: (v) => set((s) => ({ showNewPassword: typeof v === "function" ? v(s.showNewPassword) : v })),
  setShowConfirmPassword: (v) => set((s) => ({ showConfirmPassword: typeof v === "function" ? v(s.showConfirmPassword) : v })),
  setQrModal: (v) => set({ qrModal: v }),
  setQrDataUrl: (v) => set({ qrDataUrl: v }),
  setExportingImage: (v) => set({ exportingImage: v }),
  setExportingPdf: (v) => set({ exportingPdf: v }),
  setExportContext: (v) => set({ exportContext: v }),
  setProfileSections: (v) => set((s) => ({ profileSections: typeof v === "function" ? v(s.profileSections) : v })),
  setSettingsSections: (v) => set((s) => ({ settingsSections: typeof v === "function" ? v(s.settingsSections) : v })),
  setBookingFilters: (v) => set((s) => ({ bookingFilters: typeof v === "function" ? v(s.bookingFilters) : v })),
  setBookingFilterDraft: (v) => set((s) => ({ bookingFilterDraft: typeof v === "function" ? v(s.bookingFilterDraft) : v })),
  setBookingFilterOpen: (v) => set({ bookingFilterOpen: v }),
  setSessionFilters: (v) => set((s) => ({ sessionFilters: typeof v === "function" ? v(s.sessionFilters) : v })),
  setSessionFilterDraft: (v) => set((s) => ({ sessionFilterDraft: typeof v === "function" ? v(s.sessionFilterDraft) : v })),
  setSessionFilterOpen: (v) => set({ sessionFilterOpen: v }),
}));

