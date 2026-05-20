"use client";

import { FormEvent, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  Clock3,
  ListChecks,
  Share2,
  Settings,
  UserCircle2,
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { dashboardDefaultListFilters, useDashboardPageStore, type ListFilterState } from "@/store/dashboard-page-store";
import { DashboardHeader } from "@/features/dashboard/components/DashboardHeader";
import { BookingsSection } from "@/features/dashboard/components/BookingsSection";
import { DashboardDesktopTabs, DashboardMobileTabs } from "@/features/dashboard/components/DashboardTabs";
import { ProfileSection } from "@/features/dashboard/components/ProfileSection";
import { SchedulesSection } from "@/features/dashboard/components/SchedulesSection";
import { SettingsSection } from "@/features/dashboard/components/SettingsSection";
import { SessionsSection } from "@/features/dashboard/components/SessionsSection";
import type { DayItem, ProfileSectionKey, QrModalState, Question, Range, SettingsSectionKey } from "@/features/dashboard/types/dashboard";
import {
  applyListFilters,
  estimateSlotCount,
  formatPhoneForExport,
  getRangeIssues,
  getRangeLengthMinutes,
  highlightText,
  normalizePreviewUrl,
  normalizeSearchText,
  rangesOverlap,
  renderAnswers,
  toEnglishDigits,
  toJalaliLabel,
  toMinutes,
  toYmd,
  ymdToPersianDateObject,
} from "@/features/dashboard/utils/dashboard-utils";
import { AvatarPreviewModal } from "@/features/dashboard/modals/AvatarPreviewModal";
import { CancelBookingModal } from "@/features/dashboard/modals/CancelBookingModal";
import { DeleteAccountModal } from "@/features/dashboard/modals/DeleteAccountModal";
import { DeleteScheduleModal } from "@/features/dashboard/modals/DeleteScheduleModal";
import { QrShareModal } from "@/features/dashboard/modals/QrShareModal";
import { formatDurationFromMinutesFa, formatJalaliDateTime, minutesUntil } from "@/lib/date-time";
import { normalizeSmsPreferences, type SmsPreferences } from "@/lib/sms-preferences";



export default function DashboardPage() {
  const queryClient = useQueryClient();
  const tab = useUIStore((s) => s.dashboardTab);
  const setTab = useUIStore((s) => s.setDashboardTab);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const bumpAvatarRefreshToken = useUIStore((s) => s.bumpAvatarRefreshToken);

  const selectedDates = useDashboardPageStore((s) => s.selectedDates);
  const setSelectedDates = useDashboardPageStore((s) => s.setSelectedDates);
  const dayConfigs = useDashboardPageStore((s) => s.dayConfigs);
  const setDayConfigs = useDashboardPageStore((s) => s.setDayConfigs);
  const questions = useDashboardPageStore((s) => s.questions);
  const setQuestions = useDashboardPageStore((s) => s.setQuestions);
  const baseUrl = useDashboardPageStore((s) => s.baseUrl);
  const setBaseUrl = useDashboardPageStore((s) => s.setBaseUrl);
  const cancelTarget = useDashboardPageStore((s) => s.cancelTarget);
  const setCancelTarget = useDashboardPageStore((s) => s.setCancelTarget);
  const cancelLoading = useDashboardPageStore((s) => s.cancelLoading);
  const setCancelLoading = useDashboardPageStore((s) => s.setCancelLoading);
  const creatingSchedule = useDashboardPageStore((s) => s.creatingSchedule);
  const setCreatingSchedule = useDashboardPageStore((s) => s.setCreatingSchedule);
  const editingScheduleId = useDashboardPageStore((s) => s.editingScheduleId);
  const setEditingScheduleId = useDashboardPageStore((s) => s.setEditingScheduleId);
  const editingTitle = useDashboardPageStore((s) => s.editingTitle);
  const setEditingTitle = useDashboardPageStore((s) => s.setEditingTitle);
  const savingTitle = useDashboardPageStore((s) => s.savingTitle);
  const setSavingTitle = useDashboardPageStore((s) => s.setSavingTitle);
  const deleteScheduleTarget = useDashboardPageStore((s) => s.deleteScheduleTarget);
  const setDeleteScheduleTarget = useDashboardPageStore((s) => s.setDeleteScheduleTarget);
  const deletingSchedule = useDashboardPageStore((s) => s.deletingSchedule);
  const setDeletingSchedule = useDashboardPageStore((s) => s.setDeletingSchedule);
  const showCreateFormMobile = useDashboardPageStore((s) => s.showCreateFormMobile);
  const setShowCreateFormMobile = useDashboardPageStore((s) => s.setShowCreateFormMobile);
  const isExportMenuOpen = useDashboardPageStore((s) => s.isExportMenuOpen);
  const setIsExportMenuOpen = useDashboardPageStore((s) => s.setIsExportMenuOpen);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const createError = useDashboardPageStore((s) => s.createError);
  const setCreateError = useDashboardPageStore((s) => s.setCreateError);
  const slotDurationMinutes = useDashboardPageStore((s) => s.slotDurationMinutes);
  const setSlotDurationMinutes = useDashboardPageStore((s) => s.setSlotDurationMinutes);
  const gapMinutesValue = useDashboardPageStore((s) => s.gapMinutesValue);
  const setGapMinutesValue = useDashboardPageStore((s) => s.setGapMinutesValue);
  const scheduleTitle = useDashboardPageStore((s) => s.scheduleTitle);
  const setScheduleTitle = useDashboardPageStore((s) => s.setScheduleTitle);
  const profileUsername = useDashboardPageStore((s) => s.profileUsername);
  const setProfileUsername = useDashboardPageStore((s) => s.setProfileUsername);
  const profileLoading = useDashboardPageStore((s) => s.profileLoading);
  const setProfileLoading = useDashboardPageStore((s) => s.setProfileLoading);
  const smsPreferences = useDashboardPageStore((s) => s.smsPreferences);
  const setSmsPreferences = useDashboardPageStore((s) => s.setSmsPreferences);
  const smsPreferencesSaving = useDashboardPageStore((s) => s.smsPreferencesSaving);
  const setSmsPreferencesSaving = useDashboardPageStore((s) => s.setSmsPreferencesSaving);
  const smsPreferencesError = useDashboardPageStore((s) => s.smsPreferencesError);
  const setSmsPreferencesError = useDashboardPageStore((s) => s.setSmsPreferencesError);
  const requestingPasswordOtp = useDashboardPageStore((s) => s.requestingPasswordOtp);
  const setRequestingPasswordOtp = useDashboardPageStore((s) => s.setRequestingPasswordOtp);
  const passwordOtpCooldown = useDashboardPageStore((s) => s.passwordOtpCooldown);
  const setPasswordOtpCooldown = useDashboardPageStore((s) => s.setPasswordOtpCooldown);
  const passwordCode = useDashboardPageStore((s) => s.passwordCode);
  const setPasswordCode = useDashboardPageStore((s) => s.setPasswordCode);
  const newPassword = useDashboardPageStore((s) => s.newPassword);
  const setNewPassword = useDashboardPageStore((s) => s.setNewPassword);
  const confirmNewPassword = useDashboardPageStore((s) => s.confirmNewPassword);
  const setConfirmNewPassword = useDashboardPageStore((s) => s.setConfirmNewPassword);
  const deleteCode = useDashboardPageStore((s) => s.deleteCode);
  const setDeleteCode = useDashboardPageStore((s) => s.setDeleteCode);
  const deleteOtpCooldown = useDashboardPageStore((s) => s.deleteOtpCooldown);
  const setDeleteOtpCooldown = useDashboardPageStore((s) => s.setDeleteOtpCooldown);
  const requestingDeleteOtp = useDashboardPageStore((s) => s.requestingDeleteOtp);
  const setRequestingDeleteOtp = useDashboardPageStore((s) => s.setRequestingDeleteOtp);
  const deletingAccount = useDashboardPageStore((s) => s.deletingAccount);
  const setDeletingAccount = useDashboardPageStore((s) => s.setDeletingAccount);
  const avatarPreview = useDashboardPageStore((s) => s.avatarPreview);
  const setAvatarPreview = useDashboardPageStore((s) => s.setAvatarPreview);
  const deleteAccountOpen = useDashboardPageStore((s) => s.deleteAccountOpen);
  const setDeleteAccountOpen = useDashboardPageStore((s) => s.setDeleteAccountOpen);
  const showNewPassword = useDashboardPageStore((s) => s.showNewPassword);
  const setShowNewPassword = useDashboardPageStore((s) => s.setShowNewPassword);
  const showConfirmPassword = useDashboardPageStore((s) => s.showConfirmPassword);
  const setShowConfirmPassword = useDashboardPageStore((s) => s.setShowConfirmPassword);
  const qrModal = useDashboardPageStore((s) => s.qrModal);
  const setQrModal = useDashboardPageStore((s) => s.setQrModal);
  const qrDataUrl = useDashboardPageStore((s) => s.qrDataUrl);
  const setQrDataUrl = useDashboardPageStore((s) => s.setQrDataUrl);
  const exportingImage = useDashboardPageStore((s) => s.exportingImage);
  const setExportingImage = useDashboardPageStore((s) => s.setExportingImage);
  const exportingPdf = useDashboardPageStore((s) => s.exportingPdf);
  const setExportingPdf = useDashboardPageStore((s) => s.setExportingPdf);
  const exportContext = useDashboardPageStore((s) => s.exportContext);
  const setExportContext = useDashboardPageStore((s) => s.setExportContext);
  const profileSections = useDashboardPageStore((s) => s.profileSections);
  const setProfileSections = useDashboardPageStore((s) => s.setProfileSections);
  const settingsSections = useDashboardPageStore((s) => s.settingsSections);
  const setSettingsSections = useDashboardPageStore((s) => s.setSettingsSections);
  const bookingFilters = useDashboardPageStore((s) => s.bookingFilters);
  const setBookingFilters = useDashboardPageStore((s) => s.setBookingFilters);
  const bookingFilterDraft = useDashboardPageStore((s) => s.bookingFilterDraft);
  const setBookingFilterDraft = useDashboardPageStore((s) => s.setBookingFilterDraft);
  const bookingFilterOpen = useDashboardPageStore((s) => s.bookingFilterOpen);
  const setBookingFilterOpen = useDashboardPageStore((s) => s.setBookingFilterOpen);
  const sessionFilters = useDashboardPageStore((s) => s.sessionFilters);
  const setSessionFilters = useDashboardPageStore((s) => s.setSessionFilters);
  const sessionFilterDraft = useDashboardPageStore((s) => s.sessionFilterDraft);
  const setSessionFilterDraft = useDashboardPageStore((s) => s.setSessionFilterDraft);
  const sessionFilterOpen = useDashboardPageStore((s) => s.sessionFilterOpen);
  const setSessionFilterOpen = useDashboardPageStore((s) => s.setSessionFilterOpen);

  useEffect(() => {
    if (passwordOtpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setPasswordOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [passwordOtpCooldown]);

  useEffect(() => {
    if (deleteOtpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setDeleteOtpCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deleteOtpCooldown]);

  useEffect(() => {
    if (!qrModal?.url) {
      setQrDataUrl("");
      return;
    }
    let active = true;
    QRCode.toDataURL(qrModal.url, { margin: 1, width: 360 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [qrModal?.url]);

  function openAvatarPreview(src: string | null | undefined, name: string) {
    const url = normalizePreviewUrl(src) || (theme === "light" ? "/default-avatar-light.svg" : "/default-avatar-dark.svg");
    setAvatarPreview({ url, name });
  }

  function toggleProfileSection(key: ProfileSectionKey) {
    setProfileSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleSettingsSection(key: SettingsSectionKey) {
    setSettingsSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function bookingMatchesQuery(item: any, rawQuery: string) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return true;
    const fields = [
      item?.schedule?.title,
      item?.bookedByUser?.username,
      item?.bookedByUser?.phone,
      item?.visitorName,
      Array.isArray(item?.answers) ? item.answers.join(" ") : item?.answers,
    ];
    return fields.some((field) => normalizeSearchText(field).includes(query));
  }

  function sessionMatchesQuery(item: any, rawQuery: string) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return true;
    const fields = [
      item?.schedule?.title,
      item?.schedule?.user?.username,
      item?.schedule?.user?.phone,
      Array.isArray(item?.answers) ? item.answers.join(" ") : item?.answers,
    ];
    return fields.some((field) => normalizeSearchText(field).includes(query));
  }

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      if (!me.ok) throw new Error("UNAUTHORIZED");
      const meData = await me.json();
      return meData.user;
    },
  });

  const smsPreferencesQuery = useQuery({
    queryKey: ["profile", "sms-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/profile/sms-preferences", { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_SMS_PREFS");
      return res.json();
    },
  });

  const schedulesQuery = useQuery({
    queryKey: ["schedules", "my"],
    queryFn: async () => {
      const res = await fetch("/api/schedules/my", { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_SCHEDULES");
      return res.json();
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "my"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/my", { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_BOOKINGS");
      return res.json();
    },
  });

  const mySessionsQuery = useQuery({
    queryKey: ["bookings", "mine"],
    queryFn: async () => {
      const res = await fetch("/api/bookings/mine", { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_MINE");
      return res.json();
    },
  });

  const user = meQuery.data ?? null;
  const schedules = schedulesQuery.data ?? [];
  const bookings = bookingsQuery.data ?? [];
  const mySessions = mySessionsQuery.data ?? [];
  const smsPreferencesData = smsPreferencesQuery.data ?? null;

  const bookingScheduleOptions = useMemo(
    () => schedules.map((s: any) => ({ id: s.id, title: s.title })),
    [schedules],
  );

  const sessionScheduleOptions = useMemo(() => {
    const map = new Map<string, string>();
    mySessions.forEach((s: any) => {
      if (s?.schedule?.id) map.set(s.schedule.id, s.schedule?.title || "-");
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [mySessions]);

  const filteredBookings = useMemo(() => {
    const list = applyListFilters(bookings, bookingFilters, bookingMatchesQuery);
    return [...list].sort((a, b) => {
      const aTime = a?.timeSlot?.startTime ? new Date(a.timeSlot.startTime).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b?.timeSlot?.startTime ? new Date(b.timeSlot.startTime).getTime() : Number.POSITIVE_INFINITY;
      if (bookingFilters.sort === "time-asc") return aTime - bTime;
      if (bookingFilters.sort === "time-desc") return bTime - aTime;
      const aName = (a?.schedule?.title || "").localeCompare(b?.schedule?.title || "", "fa");
      return bookingFilters.sort === "name-asc" ? aName : -aName;
    });
  }, [bookings, bookingFilters]);

  const filteredMySessions = useMemo(() => {
    const list = applyListFilters(mySessions, sessionFilters, sessionMatchesQuery);
    return [...list].sort((a, b) => {
      const aTime = a?.timeSlot?.startTime ? new Date(a.timeSlot.startTime).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b?.timeSlot?.startTime ? new Date(b.timeSlot.startTime).getTime() : Number.POSITIVE_INFINITY;
      if (sessionFilters.sort === "time-asc") return aTime - bTime;
      if (sessionFilters.sort === "time-desc") return bTime - aTime;
      const aName = (a?.schedule?.title || "").localeCompare(b?.schedule?.title || "", "fa");
      return sessionFilters.sort === "name-asc" ? aName : -aName;
    });
  }, [mySessions, sessionFilters]);
  const renderAnswersWithHighlight = (answers: any, questions: any, query: string) =>
    renderAnswers(answers, questions, query, highlightText);

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin.replace(/\/$/, ""));
  }, []);

  useEffect(() => {
    if (meQuery.error && (meQuery.error as Error).message === "UNAUTHORIZED") {
      window.location.href = "/login";
    }
  }, [meQuery.error]);

  useEffect(() => {
    if (user) setProfileUsername(user?.username || "");
  }, [user]);

  useEffect(() => {
    if (smsPreferencesData) {
      setSmsPreferences(normalizeSmsPreferences(smsPreferencesData));
    }
  }, [smsPreferencesData]);

  useEffect(() => {
    setDayConfigs((prev) => {
      const map = new Map(prev.map((d) => [d.date, d]));
      return selectedDates.map((d) => map.get(d) || { date: d, ranges: [{ startTime: "10:00", endTime: "13:00" }] });
    });
  }, [selectedDates]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setIsExportMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const isInvalidTimeConfig = useMemo(() => dayConfigs.some((d) => rangesOverlap(d.ranges)), [dayConfigs]);
  const rangeIssuesByDate = useMemo(() => {
    const map = new Map<string, Array<string | null>>();
    dayConfigs.forEach((d) => map.set(d.date, getRangeIssues(d.ranges)));
    return map;
  }, [dayConfigs]);
  const slotCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    dayConfigs.forEach((d) => {
      const count = d.ranges.reduce(
        (sum, r) => sum + estimateSlotCount(r, slotDurationMinutes, gapMinutesValue),
        0,
      );
      map.set(d.date, count);
    });
    return map;
  }, [dayConfigs, slotDurationMinutes, gapMinutesValue]);
  const totalSlotCount = useMemo(() => {
    return Array.from(slotCountByDate.values()).reduce((sum, v) => sum + v, 0);
  }, [slotCountByDate]);
  const canCreateSchedule = !isInvalidTimeConfig && totalSlotCount > 0;
  const nextSession = filteredMySessions.length > 0 ? filteredMySessions[0] : null;
  useEffect(() => {
    const raw = localStorage.getItem("bookhub:schedule-draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        title?: string;
        slotDuration?: number;
        gapMinutes?: number;
        selectedDates?: string[];
        dayConfigs?: DayItem[];
        questions?: Question[];
      };
      if (typeof draft.title === "string") setScheduleTitle(draft.title);
      if (typeof draft.slotDuration === "number") setSlotDurationMinutes(draft.slotDuration);
      if (typeof draft.gapMinutes === "number") setGapMinutesValue(draft.gapMinutes);
      if (Array.isArray(draft.selectedDates)) setSelectedDates(draft.selectedDates);
      if (Array.isArray(draft.dayConfigs)) setDayConfigs(draft.dayConfigs);
      if (Array.isArray(draft.questions)) setQuestions(draft.questions);
    } catch {
      localStorage.removeItem("bookhub:schedule-draft");
    }
  }, []);

  useEffect(() => {
    const payload = {
      title: scheduleTitle,
      slotDuration: slotDurationMinutes,
      gapMinutes: gapMinutesValue,
      selectedDates,
      dayConfigs,
      questions,
    };
    localStorage.setItem("bookhub:schedule-draft", JSON.stringify(payload));
  }, [scheduleTitle, slotDurationMinutes, gapMinutesValue, selectedDates, dayConfigs, questions]);

  const pickerValue = useMemo(() => selectedDates.map((d) => ymdToPersianDateObject(d)), [selectedDates]);
  const todayTehranYmd = useMemo(
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran" }).format(new Date()),
    [],
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function updateRange(day: string, index: number, key: keyof Range, value: string) {
    setDayConfigs((prev) =>
      prev.map((d) =>
        d.date === day
          ? { ...d, ranges: d.ranges.map((r, i) => (i === index ? { ...r, [key]: value } : r)) }
          : d,
      ),
    );
  }

  function addRange(day: string) {
    setDayConfigs((prev) =>
      prev.map((d) => (d.date === day ? { ...d, ranges: [...d.ranges, { startTime: "15:00", endTime: "17:00" }] } : d)),
    );
  }

  function removeRange(day: string, index: number) {
    setDayConfigs((prev) =>
      prev.map((d) => {
        if (d.date !== day) return d;
        if (d.ranges.length <= 1) return d;
        return { ...d, ranges: d.ranges.filter((_, i) => i !== index) };
      }),
    );
  }

  async function createSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    if (dayConfigs.length === 0) {
      const message = "حداقل یک تاریخ انتخاب کنید";
      setCreateError(message);
      return toast.error(message);
    }
    if (dayConfigs.some((d) => d.date < todayTehranYmd)) {
      const message = "تاریخ برنامه نباید قبل از امروز باشد";
      setCreateError(message);
      return toast.error(message);
    }
    if (dayConfigs.some((d) => d.ranges.length === 0)) {
      const message = "برای هر تاریخ حداقل یک بازه زمانی لازم است";
      setCreateError(message);
      return toast.error(message);
    }
    if (isInvalidTimeConfig) {
      const message = "تداخل یا نامعتبر بودن بازه‌های زمانی را اصلاح کنید";
      setCreateError(message);
      return toast.error(message);
    }

    const payload = {
      title: String(f.get("title")),
      slotDuration: Number(f.get("slotDuration")),
      gapMinutes: Number(f.get("gapMinutes")),
      daysConfig: dayConfigs,
      questions: questions.filter((q) => q.label.trim().length > 0),
    };

    setCreatingSchedule(true);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      setCreatingSchedule(false);
      const message = data.details || data.error || "خطا";
      setCreateError(message);
      return toast.error(message);
    }

    queryClient.setQueryData(["schedules", "my"], (prev: any) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const exists = prevList.some((item: any) => item?.id === data?.id);
      if (exists) return prevList;
      return [data, ...prevList];
    });

    toast.success("برنامه ساخته شد");
    setCreatingSchedule(false);
    setCreateError("");
    setSelectedDates([]);
    setDayConfigs([]);
    setQuestions([]);
    setScheduleTitle("");
    localStorage.removeItem("bookhub:schedule-draft");
    setShowCreateFormMobile(false);
    (e.currentTarget as HTMLFormElement).reset();
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["schedules", "my"] }),
      queryClient.refetchQueries({ queryKey: ["bookings", "my"] }),
      queryClient.refetchQueries({ queryKey: ["bookings", "mine"] }),
    ]);
  }

  function addQuestion() {
    if (questions.length >= 5) return;
    setQuestions((prev) => [...prev, { label: "", type: "text", required: false }]);
  }

  function getShareUrl(shareId: string) {
    const origin = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    return `${origin}/schedule/${shareId}`;
  }

  function openQrModal(schedule: any) {
    if (!schedule?.shareId) return;
    setQrModal({ schedule, url: getShareUrl(schedule.shareId) });
  }

  async function shareQrLink() {
    if (!qrModal?.url) return;
    if (navigator.share) {
      try {
        if (qrDataUrl) {
          const blob = await fetch(qrDataUrl).then((res) => res.blob());
          const file = new File([blob], "bookhub-qr.png", { type: blob.type || "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: "لینک برنامه", url: qrModal.url, files: [file] });
            return;
          }
        }
        await navigator.share({ title: "لینک برنامه", url: qrModal.url });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(qrModal.url);
      toast.success("لینک کپی شد");
    } catch {
      toast.error("امکان اشتراک‌گذاری وجود ندارد");
    }
  }

  function getExportFileStamp(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}${m}${d}-${h}${min}`;
  }

  function buildExportContext(now: Date) {
    if (bookingFilters.scheduleIds.length === 1) {
      const selected = schedules.find((s: any) => s.id === bookingFilters.scheduleIds[0]);
      return {
        title: selected?.title || "برنامه انتخابی",
        stamp: formatJalaliDateTime(now),
        count: filteredBookings.length,
      };
    }

    if (bookingFilters.scheduleIds.length > 1) {
      return {
        title: `چند برنامه (${bookingFilters.scheduleIds.length})`,
        stamp: formatJalaliDateTime(now),
        count: filteredBookings.length,
      };
    }

    return {
      title: "همه برنامه‌ها",
      stamp: formatJalaliDateTime(now),
      count: filteredBookings.length,
    };
  }

  function splitTextToLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const normalized = String(text || "-");
    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length > 0 ? lines : ["-"];
  }

  function buildExportRows() {
    return filteredBookings.map((b) => ({
      schedule: b.schedule?.title || "-",
      name: b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر",
      phone: formatPhoneForExport(b.bookedByUser?.phone || "-"),
      time: b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-",
    }));
  }

  async function renderExportCanvas() {
    const now = new Date();
    setExportContext(buildExportContext(now));
    const rows = buildExportRows();
    const context = buildExportContext(now);

    if (typeof document !== "undefined" && "fonts" in document) {
      await Promise.allSettled([
        document.fonts.load("400 12px Vazirmatn"),
        document.fonts.load("700 18px Vazirmatn"),
      ]);
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_CONTEXT_FAILED");

    const padding = 24;
    const tableTop = 108;
    const headerHeight = 34;
    const lineHeight = 18;
    const cellPad = 8;
    const cols = [
      { key: "schedule", label: "برنامه", width: 270 },
      { key: "name", label: "رزروکننده", width: 220 },
      { key: "phone", label: "شماره", width: 170 },
      { key: "time", label: "زمان", width: 280 },
    ] as const;
    const tableWidth = cols.reduce((sum, c) => sum + c.width, 0);
    const baseWidth = padding * 2 + tableWidth;

    ctx.font = '12px "Vazirmatn", Tahoma, sans-serif';
    const rowHeights = rows.map((row) => {
      const maxLines = Math.max(
        ...cols.map((col) => splitTextToLines(ctx, String(row[col.key]), col.width - cellPad * 2).length),
      );
      return Math.max(30, maxLines * lineHeight + cellPad * 2);
    });
    const tableHeight = headerHeight + rowHeights.reduce((sum, h) => sum + h, 0);
    const baseHeight = tableTop + tableHeight + padding;

    canvas.width = baseWidth * 2;
    canvas.height = baseHeight * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    ctx.direction = "rtl";
    ctx.textAlign = "right";

    ctx.fillStyle = "#0f172a";
    ctx.font = '700 22px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText("گزارش رزروها", baseWidth - padding, 40);
    ctx.fillStyle = "#475569";
    ctx.font = '400 12px "Vazirmatn", Tahoma, sans-serif';
    ctx.fillText(`${context.title} · ${context.count} رزرو`, baseWidth - padding, 64);
    ctx.fillText(`زمان دانلود: ${context.stamp}`, baseWidth - padding, 84);

    let y = tableTop;
    let x = padding;
    ctx.strokeStyle = "#cbd5e1";
    ctx.fillStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    cols.forEach((col) => {
      ctx.fillRect(x, y, col.width, headerHeight);
      ctx.strokeRect(x, y, col.width, headerHeight);
      ctx.fillStyle = "#1e293b";
      ctx.font = '700 12px "Vazirmatn", Tahoma, sans-serif';
      ctx.fillText(col.label, x + col.width - cellPad, y + 22);
      ctx.fillStyle = "#f1f5f9";
      x += col.width;
    });
    y += headerHeight;

    rows.forEach((row, idx) => {
      const rowHeight = rowHeights[idx];
      let rowX = padding;
      cols.forEach((col) => {
        ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        ctx.fillRect(rowX, y, col.width, rowHeight);
        ctx.strokeStyle = "#e2e8f0";
        ctx.strokeRect(rowX, y, col.width, rowHeight);
        const lines = splitTextToLines(ctx, String(row[col.key]), col.width - cellPad * 2);
        ctx.fillStyle = "#0f172a";
        ctx.font = '400 12px "Vazirmatn", Tahoma, sans-serif';
        lines.forEach((line, lineIdx) => {
          ctx.fillText(line, rowX + col.width - cellPad, y + cellPad + 14 + lineIdx * lineHeight);
        });
        rowX += col.width;
      });
      y += rowHeight;
    });

    return { canvas, now };
  }

  async function exportBookingsAsImage() {
    setExportingImage(true);
    try {
      const { canvas, now } = await renderExportCanvas();
      const dataUrl = canvas.toDataURL("image/png");
      const fileStamp = getExportFileStamp(now);
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `bookings-${fileStamp}.png`;
      link.click();
    } catch {
      toast.error("خروجی تصویر ناموفق بود");
    } finally {
      setExportingImage(false);
      setIsExportMenuOpen(false);
    }
  }

  async function exportBookingsAsPdf() {
    setExportingPdf(true);
    try {
      const { canvas, now } = await renderExportCanvas();
      const pngDataUrl = canvas.toDataURL("image/png");

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setProperties({
        title: "گزارش رزروها",
        subject: "Bookings Export",
        author: "BookHub",
        creator: "BookHub Dashboard",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 36;
      const marginY = 28;
      const contentWidth = pageWidth - marginX * 2;
      const contentHeight = pageHeight - marginY * 2;
      const imageMeta = doc.getImageProperties(pngDataUrl);
      const renderedHeight = (imageMeta.height * contentWidth) / imageMeta.width;
      let positionY = marginY;
      let remainingHeight = renderedHeight;

      doc.addImage(pngDataUrl, "PNG", marginX, positionY, contentWidth, renderedHeight, undefined, "FAST");
      remainingHeight -= contentHeight;

      while (remainingHeight > 0) {
        doc.addPage();
        positionY = marginY - (renderedHeight - remainingHeight);
        doc.addImage(pngDataUrl, "PNG", marginX, positionY, contentWidth, renderedHeight, undefined, "FAST");
        remainingHeight -= contentHeight;
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`صفحه ${i} از ${pageCount}`, marginX, pageHeight - 18, { align: "left" });
      }

      const fileStamp = getExportFileStamp(now);
      doc.save(`bookings-${fileStamp}.pdf`);
    } catch {
      toast.error("خروجی PDF ناموفق بود");
    } finally {
      setExportingPdf(false);
      setIsExportMenuOpen(false);
    }
  }

  async function cancelBooking() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    const res = await fetch(`/api/bookings/${cancelTarget.id}/cancel`, { method: "POST" });
    const data = await res.json();
    setCancelLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "خطا در کنسل رزرو");
    toast.success("رزرو با موفقیت کنسل شد");
    setCancelTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
    ]);
  }

  function startEditScheduleTitle(schedule: any) {
    setEditingScheduleId(schedule.id);
    setEditingTitle(schedule.title || "");
  }

  function stopEditScheduleTitle() {
    setEditingScheduleId(null);
    setEditingTitle("");
  }

  async function saveScheduleTitle(scheduleId: string) {
    const title = editingTitle.trim();
    if (title.length < 3) return toast.error("عنوان برنامه باید حداقل ۳ کاراکتر باشد");
    if (title.length > 120) return toast.error("عنوان برنامه نمی‌تواند بیشتر از ۱۲۰ کاراکتر باشد");

    setSavingTitle(true);
    const res = await fetch(`/api/schedules/id/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    setSavingTitle(false);

    if (!res.ok) return toast.error(data.details || data.error || "خطا در ویرایش عنوان برنامه");

    await queryClient.invalidateQueries({ queryKey: ["schedules", "my"] });
    toast.success("نام برنامه ویرایش شد");
    stopEditScheduleTitle();
  }

  async function deleteSchedule() {
    if (!deleteScheduleTarget) return;
    setDeletingSchedule(true);
    const res = await fetch(`/api/schedules/id/${deleteScheduleTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingSchedule(false);
    if (!res.ok) return toast.error(data.details || data.error || "خطا در حذف برنامه");

    toast.success("برنامه حذف شد");
    setDeleteScheduleTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
    ]);
  }

  async function updateSmsPreferences(nextPrefs: SmsPreferences) {
    setSmsPreferencesSaving(true);
    setSmsPreferencesError("");
    const previous = smsPreferences;
    setSmsPreferences(nextPrefs);
    const res = await fetch("/api/profile/sms-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextPrefs),
    });
    const data = await res.json();
    setSmsPreferencesSaving(false);

    if (!res.ok) {
      setSmsPreferences(previous);
      setSmsPreferencesError(data.details || data.error || "خطا در ذخیره تنظیمات پیامک");
      return;
    }

    setSmsPreferences(normalizeSmsPreferences(data));
  }

  async function requestDeleteOtp() {
    if (requestingDeleteOtp || deleteOtpCooldown > 0) return;
    try {
      setRequestingDeleteOtp(true);
      const res = await fetch("/api/profile/delete/request-otp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.details || data.error || "خطا";
        const match = String(msg).match(/(\d+)/);
        if (match) setDeleteOtpCooldown(Number(match[1]));
        toast.error(msg);
        return;
      }
      setDeleteOtpCooldown(120);
      toast.success("کد تایید ارسال شد");
    } finally {
      setRequestingDeleteOtp(false);
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteCode.trim()) return toast.error("کد تایید را وارد کنید");
    setDeletingAccount(true);
    const res = await fetch("/api/profile/delete/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: deleteCode }),
    });
    setDeletingAccount(false);
    const data = await res.json();
    if (!res.ok) return toast.error(data.details || data.error || "حذف حساب ناموفق بود");
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="page-shell w-full space-y-6 overflow-x-hidden py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
      <DashboardHeader
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={logout}
        onOpenAvatar={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "کاربر")}
      />
      <DashboardDesktopTabs tab={tab} onTabChange={setTab} />

      <div className="md:contents">

        {tab === "schedules" && (
          <SchedulesSection
            showCreateFormMobile={showCreateFormMobile}
            setShowCreateFormMobile={setShowCreateFormMobile}
            createSchedule={createSchedule}
            createError={createError}
            scheduleTitle={scheduleTitle}
            setScheduleTitle={setScheduleTitle}
            pickerValue={pickerValue}
            selectedDates={selectedDates}
            setSelectedDates={setSelectedDates}
            toYmd={toYmd}
            toJalaliLabel={toJalaliLabel}
            slotDurationMinutes={slotDurationMinutes}
            setSlotDurationMinutes={setSlotDurationMinutes}
            gapMinutesValue={gapMinutesValue}
            setGapMinutesValue={setGapMinutesValue}
            totalSlotCount={totalSlotCount}
            canCreateSchedule={canCreateSchedule}
            dayConfigs={dayConfigs}
            rangeIssuesByDate={rangeIssuesByDate}
            slotCountByDate={slotCountByDate}
            formatDurationFromMinutesFa={formatDurationFromMinutesFa}
            getRangeLengthMinutes={getRangeLengthMinutes}
            updateRange={updateRange}
            removeRange={removeRange}
            addRange={addRange}
            isInvalidTimeConfig={isInvalidTimeConfig}
            addQuestion={addQuestion}
            questions={questions}
            setQuestions={setQuestions}
            creatingSchedule={creatingSchedule}
            schedules={schedules}
            editingScheduleId={editingScheduleId}
            editingTitle={editingTitle}
            setEditingTitle={setEditingTitle}
            saveScheduleTitle={saveScheduleTitle}
            savingTitle={savingTitle}
            stopEditScheduleTitle={stopEditScheduleTitle}
            startEditScheduleTitle={startEditScheduleTitle}
            getShareUrl={getShareUrl}
            openQrModal={openQrModal}
            setDeleteScheduleTarget={setDeleteScheduleTarget}
          />
        )}

      {tab === "bookings" && (
        <BookingsSection
          exportMenuRef={exportMenuRef}
          setIsExportMenuOpen={setIsExportMenuOpen}
          isExportMenuOpen={isExportMenuOpen}
          bookingFilters={bookingFilters}
          exportBookingsAsPdf={exportBookingsAsPdf}
          exportingPdf={exportingPdf}
          exportBookingsAsImage={exportBookingsAsImage}
          exportingImage={exportingImage}
          bookingFilterDraft={bookingFilterDraft}
          setBookingFilterDraft={setBookingFilterDraft}
          setBookingFilters={setBookingFilters}
          bookingFilterOpen={bookingFilterOpen}
          setBookingFilterOpen={setBookingFilterOpen}
          bookingScheduleOptions={bookingScheduleOptions}
          filteredBookings={filteredBookings}
          highlightText={highlightText}
          openAvatarPreview={openAvatarPreview}
          formatJalaliDateTime={formatJalaliDateTime}
          renderAnswers={renderAnswersWithHighlight}
          setCancelTarget={setCancelTarget}
        />
      )}

      {tab === "sessions" && (
        <SessionsSection
          sessionFilterDraft={sessionFilterDraft}
          setSessionFilterDraft={setSessionFilterDraft}
          setSessionFilters={setSessionFilters}
          sessionFilterOpen={sessionFilterOpen}
          setSessionFilterOpen={setSessionFilterOpen}
          sessionScheduleOptions={sessionScheduleOptions}
          nextSession={nextSession}
          sessionFilters={sessionFilters}
          filteredMySessions={filteredMySessions}
          highlightText={highlightText}
          formatJalaliDateTime={formatJalaliDateTime}
          minutesUntil={minutesUntil}
          formatDurationFromMinutesFa={formatDurationFromMinutesFa}
          renderAnswers={renderAnswersWithHighlight}
          openAvatarPreview={openAvatarPreview}
          setCancelTarget={setCancelTarget}
        />
      )}

      {tab === "profile" && (
        <ProfileSection
          profileSections={profileSections}
          toggleProfileSection={toggleProfileSection}
          profileLoading={profileLoading}
          setProfileLoading={setProfileLoading}
          profileUsername={profileUsername}
          setProfileUsername={setProfileUsername}
          queryClient={queryClient}
          user={user}
          openAvatarPreview={openAvatarPreview}
          bumpAvatarRefreshToken={bumpAvatarRefreshToken}
          requestingPasswordOtp={requestingPasswordOtp}
          passwordOtpCooldown={passwordOtpCooldown}
          setRequestingPasswordOtp={setRequestingPasswordOtp}
          setPasswordOtpCooldown={setPasswordOtpCooldown as any}
          passwordCode={passwordCode}
          setPasswordCode={setPasswordCode}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmNewPassword={confirmNewPassword}
          setConfirmNewPassword={setConfirmNewPassword}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword as any}
          showConfirmPassword={showConfirmPassword}
          setShowConfirmPassword={setShowConfirmPassword as any}
          setDeleteAccountOpen={setDeleteAccountOpen}
        />
      )}

      {tab === "settings" && (
        <SettingsSection
          settingsSections={settingsSections}
          toggleSettingsSection={toggleSettingsSection}
          smsPreferences={smsPreferences}
          smsPreferencesSaving={smsPreferencesSaving}
          smsPreferencesError={smsPreferencesError}
          updateSmsPreferences={updateSmsPreferences}
        />
      )}

      </div>

      <CancelBookingModal cancelTarget={cancelTarget} cancelLoading={cancelLoading} onClose={() => setCancelTarget(null)} onConfirm={cancelBooking} />
      <DeleteScheduleModal target={deleteScheduleTarget} loading={deletingSchedule} onClose={() => setDeleteScheduleTarget(null)} onConfirm={deleteSchedule} />
      <QrShareModal qrModal={qrModal} qrDataUrl={qrDataUrl} onClose={() => setQrModal(null)} onShare={shareQrLink} />
      <DashboardMobileTabs tab={tab} onTabChange={setTab} />
      <AvatarPreviewModal avatarPreview={avatarPreview} onClose={() => setAvatarPreview(null)} />
      <DeleteAccountModal
        open={deleteAccountOpen}
        deleteCode={deleteCode}
        requestingDeleteOtp={requestingDeleteOtp}
        deleteOtpCooldown={deleteOtpCooldown}
        deletingAccount={deletingAccount}
        onClose={() => setDeleteAccountOpen(false)}
        onCodeChange={setDeleteCode}
        onRequestOtp={requestDeleteOtp}
        onConfirmDelete={confirmDeleteAccount}
      />
    </main>
  );
}

