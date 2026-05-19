"use client";

import { FormEvent, type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import QRCode from "qrcode";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Pencil,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  QrCode,
  Share2,
  Settings,
  Sun,
  Trash2,
  UserCircle2,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { AvatarUploader } from "@/components/avatar-uploader";
import { UserAvatar } from "@/components/user-avatar";
import { useUIStore } from "@/store/ui-store";
import { OTP_DELAY_NOTICE } from "@/lib/ui-messages";
import { formatJalaliDateTime, minutesUntil } from "@/lib/date-time";
import { defaultSmsPreferences, normalizeSmsPreferences } from "@/lib/sms-preferences";

type Question = { label: string; type: "text" | "textarea"; required: boolean };
type Range = { startTime: string; endTime: string };
type DayItem = { date: string; ranges: Range[] };
type ProfileSectionKey = "username" | "avatar" | "password" | "delete";
type QrModalState = { schedule: any; url: string };
type ListFilterState = {
  query: string;
  from: string;
  to: string;
  includePast: boolean;
  scheduleIds: string[];
  sort: "time-asc" | "time-desc" | "name-asc" | "name-desc";
};

function toEnglishDigits(value: string) {
  return value
    .replace(/[Û°-Û¹]/g, (d) => String("Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹".indexOf(d)))
    .replace(/[Ù -Ù©]/g, (d) => String("Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©".indexOf(d)));
}

function toPersianDigits(value: string) {
  return value.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}
function formatPhoneForExport(value: any) {
  const normalized = toEnglishDigits(String(value ?? "").trim());
  if (!normalized || normalized === "-") return "-";
  return toPersianDigits(normalized);
}
function toYmd(dateObj: any) {
  if (!dateObj) return "";
  return toEnglishDigits(new DateObject(dateObj).convert(gregorian).format("YYYY-MM-DD"));
}

function ymdToPersianDateObject(ymd: string) {
  return new DateObject({
    date: ymd,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: persian_fa,
  }).convert(persian, persian_fa);
}

function toJalaliLabel(ymd: string) {
  if (!ymd) return "";
  try {
    return new DateObject({
      date: ymd,
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: persian_fa,
    })
      .convert(persian, persian_fa)
      .format("D MMMM YYYY");
  } catch {
    return ymd;
  }
}

function toMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

function normalizeSearchText(value: any) {
  return toEnglishDigits(String(value ?? "")).toLowerCase().trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(value: any, query: string) {
  const text = String(value ?? "");
  const rawQuery = query.trim();
  if (!rawQuery) return text;
  const regex = new RegExp(escapeRegExp(rawQuery), "gi");
  const parts = text.split(regex);
  const matches = text.match(regex);
  if (!matches) return text;
  return (
    <>
      {parts.map((part, idx) => (
        <span key={`${part}-${idx}`}>
          {part}
          {matches[idx] ? (
            <mark className="rounded bg-cyan-500/30 px-1 text-cyan-100">{matches[idx]}</mark>
          ) : null}
        </span>
      ))}
    </>
  );
}

function getRangeLengthMinutes(range: Range) {
  const start = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  return end - start;
}

function renderAnswers(answers: any, questions: any, query: string) {
  const items = Array.isArray(questions) && questions.length > 0
    ? questions.map((q: any, idx: number) => ({
        label: q?.label || `Ø³ÙˆØ§Ù„ ${idx + 1}`,
        value: Array.isArray(answers) ? answers[idx] : "-",
      }))
    : Array.isArray(answers)
      ? answers.map((value: any, idx: number) => ({ label: `Ù¾Ø§Ø³Ø® ${idx + 1}`, value }))
      : [];

  if (items.length === 0) {
    return <div className="text-xs text-slate-400">Ù¾Ø§Ø³Ø®ÛŒ Ø«Ø¨Øª Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.</div>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-wrap items-start justify-between gap-2 text-sm">
          <span className="text-slate-300">{highlightText(item.label, query)}</span>
          <span className="rounded-lg bg-slate-500/10 px-2 py-1 text-xs text-slate-300">
            {item.value ? highlightText(String(item.value), query) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

function estimateSlotCount(range: Range, slotDuration: number, gapMinutes: number) {
  if (slotDuration <= 0) return 0;
  const length = getRangeLengthMinutes(range);
  if (length < slotDuration) return 0;
  const step = slotDuration + Math.max(0, gapMinutes);
  return Math.max(1, Math.floor((length - slotDuration) / step) + 1);
}

function rangesOverlap(ranges: Range[]) {
  const sorted = [...ranges]
    .map((r) => ({ ...r, s: toMinutes(r.startTime), e: toMinutes(r.endTime) }))
    .sort((a, b) => a.s - b.s);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].e <= sorted[i].s) return true;
    if (i > 0 && sorted[i].s < sorted[i - 1].e) return true;
  }
  return false;
}

function getRangeIssues(ranges: Range[]) {
  const issues: Array<string | null> = Array.from({ length: ranges.length }, () => null);
  const sorted = ranges
    .map((r, idx) => ({ ...r, idx, s: toMinutes(r.startTime), e: toMinutes(r.endTime) }))
    .sort((a, b) => a.s - b.s);

  for (const item of sorted) {
    if (item.e <= item.s) {
      issues[item.idx] = "Ø²Ù…Ø§Ù† Ù¾Ø§ÛŒØ§Ù† Ø¨Ø§ÛŒØ¯ Ø¨Ø¹Ø¯ Ø§Ø² Ø²Ù…Ø§Ù† Ø´Ø±ÙˆØ¹ Ø¨Ø§Ø´Ø¯.";
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.s < prev.e) {
      issues[cur.idx] = issues[cur.idx] || "Ø§ÛŒÙ† Ø¨Ø§Ø²Ù‡ Ø¨Ø§ Ø¨Ø§Ø²Ù‡ Ù‚Ø¨Ù„ÛŒ Ù‡Ù…Ù¾ÙˆØ´Ø§Ù†ÛŒ Ø¯Ø§Ø±Ø¯.";
      issues[prev.idx] = issues[prev.idx] || "Ø§ÛŒÙ† Ø¨Ø§Ø²Ù‡ Ø¨Ø§ Ø¨Ø§Ø²Ù‡ Ø¨Ø¹Ø¯ÛŒ Ù‡Ù…Ù¾ÙˆØ´Ø§Ù†ÛŒ Ø¯Ø§Ø±Ø¯.";
    }
  }

  return issues;
}

function normalizePreviewUrl(src?: string | null) {
  if (!src) return "";
  if (src.startsWith("/")) return src;
  try {
    const url = new URL(src);
    if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/profile/avatar")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {}
  return src;
}



export default function DashboardPage() {
  const queryClient = useQueryClient();
  const tab = useUIStore((s) => s.dashboardTab);
  const setTab = useUIStore((s) => s.setDashboardTab);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const bumpAvatarRefreshToken = useUIStore((s) => s.bumpAvatarRefreshToken);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const pointerLastXRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);
  const swipeResetTimeoutRef = useRef<number | null>(null);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dayConfigs, setDayConfigs] = useState<DayItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<any | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [showCreateFormMobile, setShowCreateFormMobile] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const bookingsExportRef = useRef<HTMLDivElement | null>(null);
  const [createError, setCreateError] = useState("");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [gapMinutesValue, setGapMinutesValue] = useState(10);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [profileUsername, setProfileUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [smsPreferences, setSmsPreferences] = useState(defaultSmsPreferences);
  const [smsPreferencesSaving, setSmsPreferencesSaving] = useState(false);
  const [smsPreferencesError, setSmsPreferencesError] = useState("");
  const [requestingPasswordOtp, setRequestingPasswordOtp] = useState(false);
  const [passwordOtpCooldown, setPasswordOtpCooldown] = useState(0);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteOtpCooldown, setDeleteOtpCooldown] = useState(0);
  const [requestingDeleteOtp, setRequestingDeleteOtp] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ url: string; name: string } | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [exportingImage, setExportingImage] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportContext, setExportContext] = useState({ title: "", stamp: "", count: 0 });
  const [profileSections, setProfileSections] = useState<Record<ProfileSectionKey, boolean>>({
    username: true,
    avatar: false,
    password: false,
    delete: false,
  });
  const defaultListFilters: ListFilterState = {
    query: "",
    from: "",
    to: "",
    includePast: false,
    scheduleIds: [],
    sort: "time-asc",
  };
  const [bookingFilters, setBookingFilters] = useState<ListFilterState>({
    ...defaultListFilters,
  });
  const [bookingFilterDraft, setBookingFilterDraft] = useState<ListFilterState>({
    ...defaultListFilters,
  });
  const [bookingFilterOpen, setBookingFilterOpen] = useState(false);
  const [sessionFilters, setSessionFilters] = useState<ListFilterState>({
    ...defaultListFilters,
  });
  const [sessionFilterDraft, setSessionFilterDraft] = useState<ListFilterState>({
    ...defaultListFilters,
  });
  const [sessionFilterOpen, setSessionFilterOpen] = useState(false);

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

  function parseDateInput(value: string, endOfDay = false) {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  function applyListFilters(list: any[], filters: ListFilterState, queryMatch: (item: any, query: string) => boolean) {
    const now = Date.now();
    const fromDate = parseDateInput(filters.from);
    const toDate = parseDateInput(filters.to, true);
    const query = normalizeSearchText(filters.query);

    return list.filter((item) => {
      const start = item?.timeSlot?.startTime ? new Date(item.timeSlot.startTime).getTime() : null;
      if (filters.scheduleIds.length > 0 && !filters.scheduleIds.includes(item?.scheduleId)) return false;
      if (!filters.includePast) {
        const end = item?.timeSlot?.endTime || item?.timeSlot?.startTime;
        if (end && new Date(end).getTime() < now) return false;
      }
      if (fromDate && start !== null && start < fromDate.getTime()) return false;
      if (toDate && start !== null && start > toDate.getTime()) return false;
      if (query && !queryMatch(item, query)) return false;
      return true;
    });
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
      const message = "Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© ØªØ§Ø±ÛŒØ® Ø§Ù†ØªØ®Ø§Ø¨ Ú©Ù†ÛŒØ¯";
      setCreateError(message);
      return toast.error(message);
    }
    if (dayConfigs.some((d) => d.date < todayTehranYmd)) {
      const message = "ØªØ§Ø±ÛŒØ® Ø¨Ø±Ù†Ø§Ù…Ù‡ Ù†Ø¨Ø§ÛŒØ¯ Ù‚Ø¨Ù„ Ø§Ø² Ø§Ù…Ø±ÙˆØ² Ø¨Ø§Ø´Ø¯";
      setCreateError(message);
      return toast.error(message);
    }
    if (dayConfigs.some((d) => d.ranges.length === 0)) {
      const message = "Ø¨Ø±Ø§ÛŒ Ù‡Ø± ØªØ§Ø±ÛŒØ® Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ø¨Ø§Ø²Ù‡ Ø²Ù…Ø§Ù†ÛŒ Ù„Ø§Ø²Ù… Ø§Ø³Øª";
      setCreateError(message);
      return toast.error(message);
    }
    if (isInvalidTimeConfig) {
      const message = "ØªØ¯Ø§Ø®Ù„ ÛŒØ§ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø¨ÙˆØ¯Ù† Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ÛŒ Ø²Ù…Ø§Ù†ÛŒ Ø±Ø§ Ø§ØµÙ„Ø§Ø­ Ú©Ù†ÛŒØ¯";
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
      const message = data.details || data.error || "Ø®Ø·Ø§";
      setCreateError(message);
      return toast.error(message);
    }

    queryClient.setQueryData(["schedules", "my"], (prev: any) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const exists = prevList.some((item: any) => item?.id === data?.id);
      if (exists) return prevList;
      return [data, ...prevList];
    });

    toast.success("Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø³Ø§Ø®ØªÙ‡ Ø´Ø¯");
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
            await navigator.share({ title: "Ù„ÛŒÙ†Ú© Ø¨Ø±Ù†Ø§Ù…Ù‡", url: qrModal.url, files: [file] });
            return;
          }
        }
        await navigator.share({ title: "Ù„ÛŒÙ†Ú© Ø¨Ø±Ù†Ø§Ù…Ù‡", url: qrModal.url });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(qrModal.url);
      toast.success("Ù„ÛŒÙ†Ú© Ú©Ù¾ÛŒ Ø´Ø¯");
    } catch {
      toast.error("Ø§Ù…Ú©Ø§Ù† Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯");
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
        title: selected?.title || "Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø§Ù†ØªØ®Ø§Ø¨ÛŒ",
        stamp: formatJalaliDateTime(now),
        count: filteredBookings.length,
      };
    }

    if (bookingFilters.scheduleIds.length > 1) {
      return {
        title: `Ú†Ù†Ø¯ Ø¨Ø±Ù†Ø§Ù…Ù‡ (${bookingFilters.scheduleIds.length})`,
        stamp: formatJalaliDateTime(now),
        count: filteredBookings.length,
      };
    }

    return {
      title: "Ù‡Ù…Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§",
      stamp: formatJalaliDateTime(now),
      count: filteredBookings.length,
    };
  }

  async function captureExportPng() {
    if (!bookingsExportRef.current) throw new Error("NO_EXPORT_TARGET");
    const now = new Date();
    setExportContext(buildExportContext(now));

    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const { toPng } = await import("html-to-image");

    const target = bookingsExportRef.current;
    const prevVisibility = target.style.visibility;
    const prevOpacity = target.style.opacity;
    target.style.visibility = "visible";
    target.style.opacity = "1";
    return toPng(bookingsExportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#f8fafc",
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
      },
    }).finally(() => {
      target.style.visibility = prevVisibility;
      target.style.opacity = prevOpacity;
    });
  }

  async function exportBookingsAsImage() {
    if (!bookingsExportRef.current) return;
    setExportingImage(true);
    try {
      const dataUrl = await captureExportPng();
      const fileStamp = getExportFileStamp(new Date());
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `bookings-${fileStamp}.png`;
      link.click();
    } catch {
      toast.error("Ø®Ø±ÙˆØ¬ÛŒ ØªØµÙˆÛŒØ± Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯");
    } finally {
      setExportingImage(false);
      setIsExportMenuOpen(false);
    }
  }

  function base64FromArrayBuffer(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = Array.from(bytes.subarray(i, i + chunkSize));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  async function ensurePdfFont(doc: any) {
    try {
      if (doc.getFontList && doc.getFontList().Vazirmatn) {
        doc.setFont("Vazirmatn", "normal");
        if (doc.setR2L) doc.setR2L(true);
        return true;
      }

      const res = await fetch("/fonts/vazirmatn-arabic-400-normal.woff");
      if (!res.ok) throw new Error("FONT_LOAD_FAILED");
      const base64 = base64FromArrayBuffer(await res.arrayBuffer());
      doc.addFileToVFS("Vazirmatn.woff", base64);
      doc.addFont("Vazirmatn.woff", "Vazirmatn", "normal");
      doc.setFont("Vazirmatn", "normal");
      if (doc.setR2L) doc.setR2L(true);
      return true;
    } catch (error) {
      console.error("PDF font load failed:", error);
      doc.setFont("helvetica", "normal");
      if (doc.setR2L) doc.setR2L(false);
      return false;
    }
  }

  async function exportBookingsAsPdf() {
    setExportingPdf(true);
    try {
      const now = new Date();
      const context = buildExportContext(now);
      setExportContext(context);
      const rows = filteredBookings.map((b) => ({
        schedule: b.schedule?.title || "-",
        name: b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±",
        phone: formatPhoneForExport(b.bookedByUser?.phone || "-"),
        time: b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-",
      }));

      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      await ensurePdfFont(doc);
      doc.setProperties({
        title: "Ú¯Ø²Ø§Ø±Ø´ Ø±Ø²Ø±ÙˆÙ‡Ø§",
        subject: "Bookings Export",
        author: "BookHub",
        creator: "BookHub Dashboard",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 36;
      const marginY = 40;
      const rowPadding = 6;
      const lineHeight = 14;
      let y = marginY;

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.text("Ø®Ø±ÙˆØ¬ÛŒ Ø±Ø²Ø±ÙˆÙ‡Ø§", pageWidth - marginX, y, { align: "right" });
      y += 20;
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`${context.title} Â· ${context.count} Ø±Ø²Ø±Ùˆ`, pageWidth - marginX, y, { align: "right" });
      y += 14;
      doc.text(`Ø²Ù…Ø§Ù† Ø¯Ø§Ù†Ù„ÙˆØ¯: ${context.stamp}`, pageWidth - marginX, y, { align: "right" });
      y += 18;

      const columns = [
        { key: "schedule", label: "Ø¨Ø±Ù†Ø§Ù…Ù‡", width: 180 },
        { key: "name", label: "Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡", width: 140 },
        { key: "phone", label: "Ø´Ù…Ø§Ø±Ù‡", width: 110 },
        { key: "time", label: "Ø²Ù…Ø§Ù†", width: 150 },
      ];
      const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const tableStartX = pageWidth - marginX - tableWidth;

      const drawHeader = () => {
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.75);
        let cursorX = pageWidth - marginX;
        const headerHeight = 24;
        columns.forEach((col) => {
          const x = cursorX - col.width;
          doc.rect(x, y, col.width, headerHeight, "FD");
          doc.setTextColor(30, 41, 59);
          doc.setFontSize(10);
          doc.text(col.label, x + col.width - rowPadding, y + 16, { align: "right" });
          cursorX -= col.width;
        });
        y += headerHeight;
      };

      const drawRow = (row: (typeof rows)[number], stripe: boolean) => {
        const cellLines = columns.map((col) => {
          const value = String(row[col.key as keyof typeof row] ?? "-");
          return doc.splitTextToSize(value, col.width - rowPadding * 2) as string[];
        });
        const rowHeight = Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + rowPadding * 2;

        if (y + rowHeight > pageHeight - marginY) {
          doc.addPage();
          y = marginY;
          drawHeader();
        }

        let cursorX = pageWidth - marginX;
        doc.setDrawColor(226, 232, 240);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9);
        columns.forEach((col, idx) => {
          const x = cursorX - col.width;
          if (stripe) {
            doc.setFillColor(248, 250, 252);
            doc.rect(x, y, col.width, rowHeight, "F");
          }
          doc.rect(x, y, col.width, rowHeight, "S");
          const textX = x + col.width - rowPadding;
          const textY = y + rowPadding + lineHeight - 4;
          doc.text(cellLines[idx], textX, textY, { align: "right" });
          cursorX -= col.width;
        });
        y += rowHeight;
      };

      drawHeader();
      rows.forEach((row, idx) => drawRow(row, idx % 2 === 1));
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i += 1) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`ØµÙØ­Ù‡ ${i} Ø§Ø² ${pageCount}`, marginX, pageHeight - 18, { align: "left" });
      }

      const fileStamp = getExportFileStamp(now);
      doc.save(`bookings-${fileStamp}.pdf`);
    } catch {
      toast.error("Ø®Ø±ÙˆØ¬ÛŒ PDF Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯");
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
    if (!res.ok) return toast.error(data.details || data.error || "Ø®Ø·Ø§ Ø¯Ø± Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ");
    toast.success("Ø±Ø²Ø±Ùˆ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ú©Ù†Ø³Ù„ Ø´Ø¯");
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
    if (title.length < 3) return toast.error("Ø¹Ù†ÙˆØ§Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø¨Ø§ÛŒØ¯ Ø­Ø¯Ø§Ù‚Ù„ Û³ Ú©Ø§Ø±Ø§Ú©ØªØ± Ø¨Ø§Ø´Ø¯");
    if (title.length > 120) return toast.error("Ø¹Ù†ÙˆØ§Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡ Ù†Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø¨ÛŒØ´ØªØ± Ø§Ø² Û±Û²Û° Ú©Ø§Ø±Ø§Ú©ØªØ± Ø¨Ø§Ø´Ø¯");

    setSavingTitle(true);
    const res = await fetch(`/api/schedules/id/${scheduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    setSavingTitle(false);

    if (!res.ok) return toast.error(data.details || data.error || "Ø®Ø·Ø§ Ø¯Ø± ÙˆÛŒØ±Ø§ÛŒØ´ Ø¹Ù†ÙˆØ§Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡");

    await queryClient.invalidateQueries({ queryKey: ["schedules", "my"] });
    toast.success("Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ ÙˆÛŒØ±Ø§ÛŒØ´ Ø´Ø¯");
    stopEditScheduleTitle();
  }

  async function deleteSchedule() {
    if (!deleteScheduleTarget) return;
    setDeletingSchedule(true);
    const res = await fetch(`/api/schedules/id/${deleteScheduleTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingSchedule(false);
    if (!res.ok) return toast.error(data.details || data.error || "Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡");

    toast.success("Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø­Ø°Ù Ø´Ø¯");
    setDeleteScheduleTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
    ]);
  }

  async function updateSmsPreferences(nextPrefs: typeof defaultSmsPreferences) {
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
      setSmsPreferencesError(data.details || data.error || "Ø®Ø·Ø§ Ø¯Ø± Ø°Ø®ÛŒØ±Ù‡ ØªÙ†Ø¸ÛŒÙ…Ø§Øª Ù¾ÛŒØ§Ù…Ú©");
      return;
    }

    setSmsPreferences(normalizeSmsPreferences(data));
  }

  const tabOrder: Array<"schedules" | "bookings" | "sessions" | "profile" | "settings"> = [
    "schedules",
    "bookings",
    "sessions",
    "profile",
    "settings",
  ];
  const minSwipeDistance = 60;
  const swipeAxisThreshold = 12;
  const swipeAxisRatio = 1.15;
  const isModalOpen = Boolean(cancelTarget || deleteScheduleTarget || qrModal || avatarPreview || deleteAccountOpen);

  const finishSwipeTransition = () => {
    if (swipeResetTimeoutRef.current) {
      clearTimeout(swipeResetTimeoutRef.current);
    }
    setIsTransitioning(false);
    setSwipeOffset(0);
  };

  const resetSwipeTracking = () => {
    pointerIdRef.current = null;
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
    pointerLastXRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    if (isModalOpen || isTransitioning) return;
    if (!e.isPrimary) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, button, a, [data-no-swipe]")) return;
    if (swipeResetTimeoutRef.current) {
      clearTimeout(swipeResetTimeoutRef.current);
    }
    setSwipeOffset(0);
    setIsTransitioning(false);
    resetSwipeTracking();
    pointerIdRef.current = e.pointerId;
    pointerStartXRef.current = e.clientX;
    pointerStartYRef.current = e.clientY;
    pointerLastXRef.current = e.clientX;
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    if (isModalOpen || isTransitioning) return;
    if (pointerIdRef.current === null || pointerIdRef.current !== e.pointerId) return;
    if (pointerStartXRef.current === null || pointerStartYRef.current === null) return;

    const diff = e.clientX - pointerStartXRef.current;
    const verticalDelta = Math.abs(e.clientY - pointerStartYRef.current);
    const horizontalDelta = Math.abs(diff);

    if (isHorizontalSwipeRef.current === null) {
      if (horizontalDelta < swipeAxisThreshold && verticalDelta < swipeAxisThreshold) return;
      if (verticalDelta > swipeAxisThreshold && verticalDelta > horizontalDelta * swipeAxisRatio) {
        isHorizontalSwipeRef.current = false;
        return;
      }
      isHorizontalSwipeRef.current = horizontalDelta > verticalDelta * swipeAxisRatio;
      if (horizontalDelta <= verticalDelta * swipeAxisRatio) return;
    }

    if (!isHorizontalSwipeRef.current) return;

    e.preventDefault();

    const currentIndex = tabOrder.indexOf(tab);
    if (currentIndex === -1) return;
    if ((currentIndex === 0 && diff > 0) || (currentIndex === tabOrder.length - 1 && diff < 0)) {
      setSwipeOffset(Math.max(-36, Math.min(36, diff * 0.3)));
    } else {
      setSwipeOffset(Math.max(-160, Math.min(160, diff)));
    }

    pointerLastXRef.current = e.clientX;
  };

  const handlePointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    if (pointerIdRef.current !== e.pointerId) return;

    if (pointerStartXRef.current === null || pointerLastXRef.current === null || isHorizontalSwipeRef.current !== true) {
      setSwipeOffset(0);
      resetSwipeTracking();
      return;
    }

    const currentIndex = tabOrder.indexOf(tab);
    if (currentIndex === -1) {
      finishSwipeTransition();
      resetSwipeTracking();
      return;
    }

    const distance = pointerStartXRef.current - pointerLastXRef.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentIndex < tabOrder.length - 1) {
      setIsTransitioning(true);
      setTab(tabOrder[currentIndex + 1]);
      swipeResetTimeoutRef.current = window.setTimeout(finishSwipeTransition, 300);
    } else if (isRightSwipe && currentIndex > 0) {
      setIsTransitioning(true);
      setTab(tabOrder[currentIndex - 1]);
      swipeResetTimeoutRef.current = window.setTimeout(finishSwipeTransition, 300);
    } else {
      setSwipeOffset(0);
    }

    resetSwipeTracking();
  };

  useEffect(() => {
    return () => {
      if (swipeResetTimeoutRef.current) {
        clearTimeout(swipeResetTimeoutRef.current);
      }
      resetSwipeTracking();
    };
  }, []);

  return (
    <main className="page-shell w-full space-y-6 overflow-x-hidden py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <UserAvatar
            src={user?.avatarUrl}
            alt="avatar"
            sizeClassName="h-10 w-10"
            iconSize={16}
            onClick={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "Ú©Ø§Ø±Ø¨Ø±")}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold md:text-2xl">Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯ Ø±Ø²Ø±Ùˆ</h1>
            <p className="mt-1 text-sm text-slate-400">{user ? `${user.username || user.phone} Ø¹Ø²ÛŒØ² Ø®ÙˆØ´ Ø¢Ù…Ø¯ÛŒØ¯` : "Ù…Ø¯ÛŒØ±ÛŒØª Ø²Ù…Ø§Ù†â€ŒØ¨Ù†Ø¯ÛŒØŒ Ø±Ø²Ø±ÙˆÙ‡Ø§ Ùˆ Ù¾Ø±ÙˆÙØ§ÛŒÙ„"}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={toggleTheme} aria-label="ØªØºÛŒÛŒØ± ØªÙ…">
              {theme === "dark" ? <Sun strokeWidth={2.25} /> : <Moon strokeWidth={2.25} />}
            </button>
            <button onClick={logout} className="btn-danger header-action-btn px-3" aria-label="Ø®Ø±ÙˆØ¬" title="Ø®Ø±ÙˆØ¬">
              <LogOut size={18} className="icon-danger" />
              <span className="hidden md:inline">Ø®Ø±ÙˆØ¬</span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 md:mb-3 md:flex">
        <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("schedules")}>
          <CalendarDays size={16} /> Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ù†
        </button>
        <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("bookings")}>
          <ListChecks size={16} /> Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒ Ù…Ù†
        </button>
        <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("sessions")}>
          <Clock3 size={16} /> Ø¬Ù„Ø³Ø§Øª Ù…Ù†
        </button>
        <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("profile")}>
          <UserCircle2 size={16} /> Ù¾Ø±ÙˆÙØ§ÛŒÙ„
        </button>
        <button className={`btn ${tab === "settings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("settings")}>
          <Settings size={16} /> ØªÙ†Ø¸ÛŒÙ…Ø§Øª
        </button>
      </div>

      <div
        className="relative md:contents"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isTransitioning ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          opacity: isTransitioning ? 0.7 : 1,
          willChange: "transform, opacity",
          touchAction: "pan-y",
          overscrollBehaviorX: "contain",
        }}
      >
        {Math.abs(swipeOffset) > 10 && (
          <>
            {swipeOffset > 0 && tabOrder.indexOf(tab) > 0 && (
          <div 
            className="pointer-events-none fixed left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cyan-500/20 p-3 backdrop-blur-sm md:hidden"
            style={{ opacity: Math.min(Math.abs(swipeOffset) / 100, 0.8) }}
              >
                <ChevronDown size={24} className="rotate-90 text-cyan-300" />
              </div>
            )}
            {swipeOffset < 0 && tabOrder.indexOf(tab) < tabOrder.length - 1 && (
          <div 
            className="pointer-events-none fixed right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-cyan-500/20 p-3 backdrop-blur-sm md:hidden"
            style={{ opacity: Math.min(Math.abs(swipeOffset) / 100, 0.8) }}
              >
                <ChevronDown size={24} className="-rotate-90 text-cyan-300" />
              </div>
            )}
          </>
        )}

        {tab === "schedules" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold md:text-xl">Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ù†</h2>
            <p className="mt-1 text-sm text-slate-400">Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ø²Ù…Ø§Ù†ÛŒ Ø®ÙˆØ¯ Ø±Ø§ Ø¨Ø³Ø§Ø²ÛŒØ¯ØŒ ÙˆÛŒØ±Ø§ÛŒØ´ Ú©Ù†ÛŒØ¯ Ùˆ Ù„ÛŒÙ†Ú© Ø±Ø²Ø±Ùˆ Ù‡Ø± Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø±Ø§ Ù…Ø¯ÛŒØ±ÛŒØª Ú©Ù†ÛŒØ¯.</p>
          </div>
          <div className="md:hidden">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setShowCreateFormMobile((prev) => !prev)}
            >
              <Plus size={16} /> {showCreateFormMobile ? "Ø¨Ø³ØªÙ† ÙØ±Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø¬Ø¯ÛŒØ¯" : "Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø¬Ø¯ÛŒØ¯"}
            </button>
          </div>

          <form
            onSubmit={createSchedule}
            className={`card space-y-4 p-4 md:p-5 ${showCreateFormMobile ? "block" : "hidden md:block"}`}
          >
            <h2 className="font-bold">Ø³Ø§Ø®Øª Ø¨Ø±Ù†Ø§Ù…Ù‡ Ø¬Ø¯ÛŒØ¯</h2>
            {createError && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {createError}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-slate-300">Ø¹Ù†ÙˆØ§Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡</label>
              <input
                className="input"
                name="title"
                placeholder="Ù…Ø«Ù„Ø§Ù‹ Ù…Ø´Ø§ÙˆØ±Ù‡ Ù¾Ø§ÛŒØ§Ù†â€ŒÙ†Ø§Ù…Ù‡"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Ø§Ù†ØªØ®Ø§Ø¨ ØªØ§Ø±ÛŒØ®â€ŒÙ‡Ø§</label>
              <DatePicker
                multiple
                calendar={persian}
                locale={persian_fa}
                value={pickerValue}
                onChange={(v: any) => {
                  const arr = Array.isArray(v) ? v : v ? [v] : [];
                  const normalized = Array.from(new Set(arr.map((x: any) => toYmd(x)).filter(Boolean)));
                  setSelectedDates(normalized);
                }}
                mapDays={({ date }: any) => {
                  const ymd = toYmd(date);
                  if (selectedDates.includes(ymd)) {
                    return {
                      style: {
                        backgroundColor: "rgb(223, 208, 184)",
                        color: "rgb(34, 40, 49)",
                        borderRadius: "10px",
                        fontWeight: "700",
                      },
                    };
                  }
                  return {};
                }}
                render={(value, openCalendar) => (
                  <button type="button" onClick={openCalendar} className="btn-ghost w-full justify-between">
                    <span className="flex items-center gap-2"><CalendarDays size={16} /> {selectedDates.length > 0 ? `${selectedDates.length} ØªØ§Ø±ÛŒØ® Ø§Ù†ØªØ®Ø§Ø¨ Ø´Ø¯Ù‡` : "Ø§Ù†ØªØ®Ø§Ø¨ ØªØ§Ø±ÛŒØ®"}</span>
                    <span className="text-xs text-slate-400">{value || ""}</span>
                  </button>
                )}
                calendarPosition="bottom-right"
              />
              {selectedDates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDates.map((d) => (
                    <span key={d} className="rounded-full border border-cyan-700 bg-cyan-900/30 px-3 py-1 text-xs text-cyan-200">{toJalaliLabel(d)}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Ù…Ø¯Øª Ù‡Ø± Ø§Ø±Ø§Ø¦Ù‡ (Ø¯Ù‚ÛŒÙ‚Ù‡)</label>
                <input
                  className="input"
                  name="slotDuration"
                  type="number"
                  min={5}
                  value={slotDurationMinutes}
                  onChange={(e) => setSlotDurationMinutes(Number(e.target.value) || 0)}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">ÙØ§ØµÙ„Ù‡ Ø¨ÛŒÙ† Ø§Ø±Ø§Ø¦Ù‡â€ŒÙ‡Ø§ (Ø¯Ù‚ÛŒÙ‚Ù‡)</label>
                <input
                  className="input"
                  name="gapMinutes"
                  type="number"
                  min={0}
                  value={gapMinutesValue}
                  onChange={(e) => setGapMinutesValue(Number(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl surface-block p-3">
              <p className="text-sm text-slate-300">Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ÛŒ Ø²Ù…Ø§Ù†ÛŒ Ù‡Ø± ØªØ§Ø±ÛŒØ®</p>
              <p className="text-xs text-slate-400">Ù‡Ø± Ø¨Ø§Ø²Ù‡ Ø¨Ø§ÛŒØ¯ Ø­Ø¯Ø§Ù‚Ù„ Ø¨Ù‡ Ø§Ù†Ø¯Ø§Ø²Ù‡ Ù…Ø¯Øª Ø¬Ù„Ø³Ù‡ Ø¨Ø§Ø´Ø¯ ØªØ§ Ø§Ø³Ù„Ø§Øª ØªÙˆÙ„ÛŒØ¯ Ø´ÙˆØ¯.</p>
              <p className="text-xs text-slate-400">ÙØ§ØµÙ„Ù‡ Ø¨ÛŒÙ† Ø§Ø±Ø§Ø¦Ù‡â€ŒÙ‡Ø§ Ø¨Ø§ÛŒØ¯ Ø¹Ø¯Ø¯ÛŒ ØºÛŒØ±Ù…Ù†ÙÛŒ Ø¨Ø§Ø´Ø¯Ø› Ø§Ú¯Ø± Ø®ÛŒÙ„ÛŒ Ø¨Ø²Ø±Ú¯ Ø¨Ø§Ø´Ø¯ Ù…Ù…Ú©Ù† Ø§Ø³Øª ØªÙ†Ù‡Ø§ ÛŒÚ© Ø§Ø³Ù„Ø§Øª Ø¨Ø³Ø§Ø²Ø¯.</p>
              <p className="text-xs text-slate-400">Ø¬Ù…Ø¹ Ú©Ù„ Ø§Ø³Ù„Ø§Øªâ€ŒÙ‡Ø§ÛŒ Ù‚Ø§Ø¨Ù„ ØªÙˆÙ„ÛŒØ¯: {totalSlotCount}</p>
              {totalSlotCount === 0 && (
                <p className="text-xs text-rose-300">Ù‡ÛŒÚ† Ø§Ø³Ù„Ø§ØªÛŒ ØªÙˆÙ„ÛŒØ¯ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯. Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ ÛŒØ§ Ù…Ø¯Øª Ø¬Ù„Ø³Ù‡ Ø±Ø§ Ø§ØµÙ„Ø§Ø­ Ú©Ù†ÛŒØ¯.</p>
              )}
              {totalSlotCount > 0 && totalSlotCount < 3 && (
                <p className="text-xs text-amber-200">Ø§Ø³Ù„Ø§Øªâ€ŒÙ‡Ø§ÛŒ Ú©Ù…ÛŒ ØªÙˆÙ„ÛŒØ¯ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯Ø› Ù…Ù…Ú©Ù† Ø§Ø³Øª Ù†ÛŒØ§Ø² Ø¨Ù‡ Ø¨Ø§Ø²Ù‡ Ø¨ÛŒØ´ØªØ± Ø¯Ø§Ø´ØªÙ‡ Ø¨Ø§Ø´ÛŒØ¯.</p>
              )}
              {!canCreateSchedule && (
                <p className="text-xs text-rose-300">ØªØ§ Ø²Ù…Ø§Ù† Ø§ØµÙ„Ø§Ø­ Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ Ø§Ù…Ú©Ø§Ù† Ø³Ø§Ø®Øª Ø¨Ø±Ù†Ø§Ù…Ù‡ ÙˆØ¬ÙˆØ¯ Ù†Ø¯Ø§Ø±Ø¯.</p>
              )}
              {dayConfigs.map((d) => (
                <div key={d.date} className="rounded-xl surface-block p-3">
                  <div className="mb-2 text-sm text-cyan-300">{toJalaliLabel(d.date)}</div>
                  {rangeIssuesByDate.get(d.date)?.some(Boolean) && (
                    <p className="mb-2 text-xs text-rose-300">Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ©ÛŒ Ø§Ø² Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ÛŒ Ø§ÛŒÙ† ØªØ§Ø±ÛŒØ® Ù…Ø´Ú©Ù„ Ø¯Ø§Ø±Ø¯.</p>
                  )}
                  {(slotCountByDate.get(d.date) ?? 0) === 0 && (
                    <p className="mb-2 text-xs text-rose-300">Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† ØªØ§Ø±ÛŒØ® Ø§Ø³Ù„Ø§ØªÛŒ ØªÙˆÙ„ÛŒØ¯ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯.</p>
                  )}
                  {(slotCountByDate.get(d.date) ?? 0) > 0 && (slotCountByDate.get(d.date) ?? 0) < 2 && (
                    <p className="mb-2 text-xs text-amber-200">ÙÙ‚Ø· ÛŒÚ© Ø§Ø³Ù„Ø§Øª Ø¨Ø±Ø§ÛŒ Ø§ÛŒÙ† ØªØ§Ø±ÛŒØ® Ø³Ø§Ø®ØªÙ‡ Ù…ÛŒâ€ŒØ´ÙˆØ¯.</p>
                  )}
                  <div className="space-y-2">
                    {d.ranges.map((r, i) => (
                      <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <div className="md:col-span-3 text-xs text-slate-400">
                          Ø·ÙˆÙ„ Ø¨Ø§Ø²Ù‡: {getRangeLengthMinutes(r)} Ø¯Ù‚ÛŒÙ‚Ù‡
                          {slotDurationMinutes > 0 && getRangeLengthMinutes(r) < slotDurationMinutes && (
                            <span className="text-rose-300"> Â· Ú©ÙˆØªØ§Ù‡â€ŒØªØ± Ø§Ø² Ù…Ø¯Øª Ø¬Ù„Ø³Ù‡ Ø§Ø³Øª</span>
                          )}
                          {slotDurationMinutes > 0 && getRangeLengthMinutes(r) === slotDurationMinutes && (
                            <span className="text-amber-200"> Â· ÙÙ‚Ø· ÛŒÚ© Ø¬Ù„Ø³Ù‡ Ø¬Ø§ Ù…ÛŒâ€ŒØ´ÙˆØ¯</span>
                          )}
                          {gapMinutesValue > 0 && getRangeLengthMinutes(r) <= slotDurationMinutes + gapMinutesValue && (
                            <span className="text-amber-200"> Â· ÙØ§ØµÙ„Ù‡ Ø¨Ø²Ø±Ú¯ Ø§Ø³Øª Ùˆ Ø§Ø­ØªÙ…Ø§Ù„Ø§Ù‹ ÙÙ‚Ø· ÛŒÚ© Ø§Ø³Ù„Ø§Øª Ù…ÛŒâ€ŒØ³Ø§Ø²Ø¯</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">Ø´Ø±ÙˆØ¹</label>
                          <input
                            className={`input time-input min-w-0 ${rangeIssuesByDate.get(d.date)?.[i] ? "border-rose-400/70 ring-2 ring-rose-400/30" : ""}`}
                            type="time"
                            value={r.startTime}
                            onChange={(e) => updateRange(d.date, i, "startTime", e.target.value)}
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">Ù¾Ø§ÛŒØ§Ù†</label>
                          <input
                            className={`input time-input min-w-0 ${rangeIssuesByDate.get(d.date)?.[i] ? "border-rose-400/70 ring-2 ring-rose-400/30" : ""}`}
                            type="time"
                            value={r.endTime}
                            onChange={(e) => updateRange(d.date, i, "endTime", e.target.value)}
                          />
                        </div>
                        <button type="button" className="btn-ghost w-full md:w-auto md:self-end" onClick={() => removeRange(d.date, i)}><Trash2 size={16} className="icon-danger" /></button>
                        {rangeIssuesByDate.get(d.date)?.[i] && (
                          <p className="text-xs text-rose-300 md:col-span-3">
                            {rangeIssuesByDate.get(d.date)?.[i]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost mt-2" onClick={() => addRange(d.date)}><Plus size={16} /> Ø§ÙØ²ÙˆØ¯Ù† Ø¨Ø§Ø²Ù‡</button>
                </div>
              ))}
              {isInvalidTimeConfig && <p className="text-sm text-rose-300">Ø¯Ø± Ø¨Ø¹Ø¶ÛŒ ØªØ§Ø±ÛŒØ®â€ŒÙ‡Ø§ ØªØ¯Ø§Ø®Ù„ ÛŒØ§ ØªØ±ØªÛŒØ¨ Ù†Ø§Ø¯Ø±Ø³Øª Ø¨Ø§Ø²Ù‡ ÙˆØ¬ÙˆØ¯ Ø¯Ø§Ø±Ø¯.</p>}
              {createError && !isInvalidTimeConfig && (
                <p className="text-sm text-rose-300">{createError}</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl surface-block p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Ø³ÙˆØ§Ù„Ø§Øª ÙØ±Ù… Ø±Ø²Ø±Ùˆ</p>
                <button type="button" className="btn-ghost" onClick={addQuestion} disabled={questions.length >= 5}><Plus size={16} /> Ø§ÙØ²ÙˆØ¯Ù† Ø³ÙˆØ§Ù„</button>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-lg surface-block p-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="Ø­Ø°Ù Ø³ÙˆØ§Ù„"
                      title="Ø­Ø°Ù Ø³ÙˆØ§Ù„"
                    >
                      <Trash2 size={14} className="icon-danger" />
                      <span>Ø­Ø°Ù Ø³ÙˆØ§Ù„</span>
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Ù…ØªÙ† Ø³ÙˆØ§Ù„</label>
                    <input
                      className="input"
                      placeholder={`Ù…ØªÙ† Ø³ÙˆØ§Ù„ ${i + 1}`}
                      value={q.label}
                      onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Ù†ÙˆØ¹ Ù¾Ø§Ø³Ø®</label>
                      <select
                        className="input"
                        value={q.type}
                        onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, type: e.target.value as "text" | "textarea" } : x)))}
                      >
                        <option value="text">Ù…ØªÙ† Ú©ÙˆØªØ§Ù‡</option>
                        <option value="textarea">Ù…ØªÙ† Ø¨Ù„Ù†Ø¯</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Ø§Ù„Ø²Ø§Ù…ÛŒ Ø¨ÙˆØ¯Ù†</label>
                      <label className="flex h-11 items-center gap-2 rounded-xl surface-block px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, required: e.target.checked } : x)))}
                        />
                        Ø§Ø¬Ø¨Ø§Ø±ÛŒ
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary w-full" disabled={!canCreateSchedule || creatingSchedule}>
              <Clock3 size={16} /> {creatingSchedule ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª..." : "Ø§ÛŒØ¬Ø§Ø¯ Ø¨Ø±Ù†Ø§Ù…Ù‡"}
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {schedules.map((s) => (
              <div className="card p-4 transition hover:-translate-y-0.5 hover:border-cyan-700" key={s.id}>
                {editingScheduleId === s.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-400">ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡</label>
                    <input
                      className="input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      maxLength={120}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-ghost text-cyan-300"
                        onClick={() => saveScheduleTitle(s.id)}
                        disabled={savingTitle}
                      >
                        {savingTitle ? "Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡..." : "Ø°Ø®ÛŒØ±Ù‡"}
                      </button>
                      <button type="button" className="btn-ghost" onClick={stopEditScheduleTitle} disabled={savingTitle}>
                        Ø§Ù†ØµØ±Ø§Ù
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold break-words text-base">{s.title}</h3>
                      <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-1 text-xs text-cyan-200">
                        Ø¨Ø±Ù†Ø§Ù…Ù‡
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })
                        : "ØªØ§Ø±ÛŒØ® Ù†Ø§Ù…Ø´Ø®Øµ"}
                    </p>
                  </div>
                )}
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <a className="block text-cyan-300 break-all" href={getShareUrl(s.shareId)}>{getShareUrl(s.shareId)}</a>
                  <div className="flex flex-wrap gap-2">
                    {editingScheduleId !== s.id && (
                      <button type="button" className="btn-ghost" onClick={() => startEditScheduleTitle(s)} aria-label="ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡" title="ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡">
                        <Pencil size={14} />
                        <span className="hidden md:inline">ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ø§Ù…</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(getShareUrl(s.shareId));
                        toast.success("Ù„ÛŒÙ†Ú© Ú©Ù¾ÛŒ Ø´Ø¯");
                      }}
                      aria-label="Ú©Ù¾ÛŒ Ù„ÛŒÙ†Ú© Ø¨Ø±Ù†Ø§Ù…Ù‡"
                      title="Ú©Ù¾ÛŒ Ù„ÛŒÙ†Ú© Ø¨Ø±Ù†Ø§Ù…Ù‡"
                    >
                      <Copy size={14} />
                      <span className="hidden md:inline">Ú©Ù¾ÛŒ Ù„ÛŒÙ†Ú©</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => openQrModal(s)}
                      aria-label="Ù†Ù…Ø§ÛŒØ´ QR Ø¨Ø±Ù†Ø§Ù…Ù‡"
                      title="Ù†Ù…Ø§ÛŒØ´ QR Ø¨Ø±Ù†Ø§Ù…Ù‡"
                    >
                      <QrCode size={14} />
                      <span className="hidden md:inline">QR Ø¨Ø±Ù†Ø§Ù…Ù‡</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDeleteScheduleTarget(s)}
                      aria-label="Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡"
                      title="Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡"
                    >
                      <Trash2 size={14} className="icon-danger" />
                      <span className="hidden md:inline">Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "bookings" && (
        <section className="card relative overflow-visible p-4 md:mt-2">
          <h2 className="mb-4 text-lg font-bold md:text-xl">Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒ Ù…Ù†</h2>
          <p className="-mt-2 mb-4 text-sm text-slate-400">Ù„ÛŒØ³Øª Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ø¯ÛŒÚ¯Ø±Ø§Ù† Ø±ÙˆÛŒ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ø´Ù…Ø§ Ø«Ø¨Øª Ú©Ø±Ø¯Ù‡â€ŒØ§Ù†Ø¯ Ø±Ø§ Ø¨Ø¨ÛŒÙ†ÛŒØ¯ Ùˆ Ø¯Ø± ØµÙˆØ±Øª Ù†ÛŒØ§Ø² Ú©Ù†Ø³Ù„ Ú©Ù†ÛŒØ¯.</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm text-slate-300">ÙÛŒÙ„ØªØ± Ø¨Ø± Ø§Ø³Ø§Ø³ Ø¨Ø±Ù†Ø§Ù…Ù‡</label>
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="btn-ghost flex items-center gap-2"
                aria-haspopup="listbox"
                aria-expanded={isExportMenuOpen}
              >
                <Download size={16} />
                <span className="hidden sm:inline">Ø®Ø±ÙˆØ¬ÛŒ Ú¯Ø±ÙØªÙ†</span>
              </button>
              <div
                className={`dropdown-panel absolute left-0 z-50 mt-2 w-48 origin-top-left rounded-2xl shadow-xl transition-all duration-200 ${
                  isExportMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
                }`}
              >
                <a
                  className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition"
                  href={`/api/bookings/my/export?format=csv${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`}
                  onClick={() => setIsExportMenuOpen(false)}
                >
                  <FileText size={14} /> CSV
                </a>
                <a
                  className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition"
                  href={`/api/bookings/my/export?format=xls${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`}
                  onClick={() => setIsExportMenuOpen(false)}
                >
                  <FileSpreadsheet size={14} /> Excel
                </a>
                <button
                  type="button"
                  className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition"
                  onClick={exportBookingsAsPdf}
                  disabled={exportingPdf}
                >
                  <FileText size={14} /> {exportingPdf ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª PDF" : "PDF"}
                </button>
                <button
                  type="button"
                  className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition"
                  onClick={exportBookingsAsImage}
                  disabled={exportingImage}
                >
                  <FileImage size={14} /> {exportingImage ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ±" : "ØªØµÙˆÛŒØ±"}
                </button>
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="input h-10"
              placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ø±Ø²Ø±ÙˆÙ‡Ø§ (Ù†Ø§Ù…ØŒ Ø´Ù…Ø§Ø±Ù‡ØŒ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§...)"
              value={bookingFilterDraft.query}
              onChange={(e) => {
                const value = e.target.value;
                setBookingFilterDraft((prev) => ({ ...prev, query: value }));
                setBookingFilters((prev) => ({ ...prev, query: value }));
              }}
            />
            <button
              type="button"
              className="btn-ghost h-10"
              onClick={() => setBookingFilterOpen((prev) => !prev)}
            >
              ÙÛŒÙ„ØªØ± Ø¨ÛŒØ´ØªØ±
            </button>
            {bookingFilterOpen && (
              <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Ø§Ø² ØªØ§Ø±ÛŒØ®</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={bookingFilterDraft.from}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">ØªØ§ ØªØ§Ø±ÛŒØ®</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={bookingFilterDraft.to}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Ù…Ø±ØªØ¨â€ŒØ³Ø§Ø²ÛŒ</label>
                  <select
                    className="input h-10"
                    value={bookingFilterDraft.sort}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}
                  >
                    <option value="time-asc">Ø²Ù…Ø§Ù† (Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ±ÛŒÙ†)</option>
                    <option value="time-desc">Ø²Ù…Ø§Ù† (Ø¯ÙˆØ±ØªØ±ÛŒÙ†)</option>
                    <option value="name-asc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (Ø§Ù„Ù-ÛŒ)</option>
                    <option value="name-desc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (ÛŒ-Ø§Ù„Ù)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">ÙÛŒÙ„ØªØ± Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs transition ${bookingFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                      onClick={() => setBookingFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}
                    >
                      Ù‡Ù…Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§
                    </button>
                    {bookingScheduleOptions.map((s) => {
                      const active = bookingFilterDraft.scheduleIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                          onClick={() =>
                            setBookingFilterDraft((prev) => ({
                              ...prev,
                              scheduleIds: active
                                ? prev.scheduleIds.filter((id) => id !== s.id)
                                : [...prev.scheduleIds, s.id],
                            }))
                          }
                        >
                          {s.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={bookingFilterDraft.includePast}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, includePast: e.target.checked }))}
                  />
                  Ù†Ù…Ø§ÛŒØ´ Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒ Ú¯Ø°Ø´ØªÙ‡
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setBookingFilters(bookingFilterDraft);
                      setBookingFilterOpen(false);
                    }}
                  >
                    Ø§Ø¹Ù…Ø§Ù„ ÙÛŒÙ„ØªØ±
                  </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                      setBookingFilterDraft(defaultListFilters);
                      setBookingFilters(defaultListFilters);
                      setBookingFilterOpen(false);
                    }}
                  >
                    Ø±ÛŒØ³Øª
                  </button>
                </div>
              </div>
            )}
          </div>
          <div
            ref={bookingsExportRef}
            className="pointer-events-none fixed left-0 top-0 z-[-1] w-[980px]"
            aria-hidden="true"
            style={{ visibility: "hidden" }}
          >
            <div
              className="border border-slate-200 bg-white p-6 text-slate-900"
              dir="rtl"
              style={{ fontFamily: "Vazirmatn, ui-sans-serif, system-ui" }}
            >
              <div className="border-b border-slate-200 pb-3">
                <div>
                  <div className="text-lg font-bold">Ú¯Ø²Ø§Ø±Ø´ Ø±Ø²Ø±ÙˆÙ‡Ø§</div>
                  <div className="text-xs text-slate-500">{exportContext.title} Â· {exportContext.count} Ø±Ø²Ø±Ùˆ</div>
                  <div className="mt-1 text-[11px] text-slate-500">Ø²Ù…Ø§Ù† Ø¯Ø§Ù†Ù„ÙˆØ¯: {exportContext.stamp}</div>
                </div>
              </div>

              <div className="mt-4 border border-slate-200 bg-white p-3">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="rounded-tr-2xl border-b border-slate-200 p-2 text-right">Ø¨Ø±Ù†Ø§Ù…Ù‡</th>
                      <th className="border-b border-slate-200 p-2 text-right">Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡</th>
                      <th className="border-b border-slate-200 p-2 text-right">Ø´Ù…Ø§Ø±Ù‡</th>
                      <th className="rounded-tl-2xl border-b border-slate-200 p-2 text-right">Ø²Ù…Ø§Ù†</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b, idx) => (
                      <tr key={b.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border-b border-slate-100 p-2">{b.schedule?.title || "-"}</td>
                        <td className="border-b border-slate-100 p-2">{b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±"}</td>
                        <td className="border-b border-slate-100 p-2">{formatPhoneForExport(b.bookedByUser?.phone || "-")}</td>
                        <td className="border-b border-slate-100 p-2">{b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
          <div className="space-y-3">
            {filteredBookings.length === 0 && <div className="text-sm text-slate-400">Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ ÙÛŒÙ„ØªØ± Ø§Ù†ØªØ®Ø§Ø¨ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.</div>}
            {filteredBookings.map((b) => (
              <div key={b.id} className="rounded-xl surface-block p-3">
                <div className="font-medium break-words">{highlightText(b.schedule.title, bookingFilters.query)}</div>
                <div className="text-sm text-slate-400">
                  Ù†Ø§Ù… Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡: {highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±", bookingFilters.query)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡:</span>
                  <span dir="ltr">{highlightText(b.bookedByUser?.phone || "-", bookingFilters.query)}</span>
                  {b.bookedByUser?.phone && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-500/10 hover:text-cyan-300"
                      onClick={async () => {
                        await navigator.clipboard.writeText(b.bookedByUser.phone);
                        toast.success("Ø´Ù…Ø§Ø±Ù‡ Ú©Ù¾ÛŒ Ø´Ø¯");
                      }}
                      aria-label="Ú©Ù¾ÛŒ Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡"
                      title="Ú©Ù¾ÛŒ Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡"
                    >
                      <Copy size={12} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    src={b.bookedByUser?.avatarUrl}
                    alt="booker avatar"
                    sizeClassName="h-8 w-8"
                    iconSize={14}
                    onClick={() => openAvatarPreview(b.bookedByUser?.avatarUrl, b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±")}
                  />
                  <div className="text-xs text-slate-400">{highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø± Ù…Ù‡Ù…Ø§Ù†", bookingFilters.query)}</div>
                </div>
                <div className="text-sm text-slate-400">
                  Ø²Ù…Ø§Ù†: {b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}
                </div>
                <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
                  <div className="mb-2 text-xs text-slate-400">Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ ÙØ±Ù…</div>
                  {renderAnswers(b.answers, b.schedule?.questions, bookingFilters.query)}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setCancelTarget(b)}
                    aria-label="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ"
                    title="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ"
                  >
                    <XCircle size={14} className="icon-danger" />
                    <span>Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "sessions" && (
        <section className="card p-4 md:mt-2">
          <h2 className="mb-4 text-lg font-bold md:text-xl">Ø¬Ù„Ø³Ø§Øª Ù…Ù†</h2>
          <p className="-mt-2 mb-4 text-sm text-slate-400">Ø¬Ù„Ø³Ù‡â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ø®ÙˆØ¯ØªØ§Ù† Ø±Ø²Ø±Ùˆ Ú©Ø±Ø¯Ù‡â€ŒØ§ÛŒØ¯ Ù‡Ù…Ø±Ø§Ù‡ Ø¨Ø§ Ø²Ù…Ø§Ù† Ùˆ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ Ø«Ø¨Øªâ€ŒØ´Ø¯Ù‡ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.</p>
          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="input h-10"
              placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ø¬Ù„Ø³Ø§Øª (Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ØŒ Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡ØŒ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§...)"
              value={sessionFilterDraft.query}
              onChange={(e) => {
                const value = e.target.value;
                setSessionFilterDraft((prev) => ({ ...prev, query: value }));
                setSessionFilters((prev) => ({ ...prev, query: value }));
              }}
            />
            <button
              type="button"
              className="btn-ghost h-10"
              onClick={() => setSessionFilterOpen((prev) => !prev)}
            >
              ÙÛŒÙ„ØªØ± Ø¨ÛŒØ´ØªØ±
            </button>
            {sessionFilterOpen && (
              <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Ø§Ø² ØªØ§Ø±ÛŒØ®</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={sessionFilterDraft.from}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">ØªØ§ ØªØ§Ø±ÛŒØ®</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={sessionFilterDraft.to}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Ù…Ø±ØªØ¨â€ŒØ³Ø§Ø²ÛŒ</label>
                  <select
                    className="input h-10"
                    value={sessionFilterDraft.sort}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}
                  >
                    <option value="time-asc">Ø²Ù…Ø§Ù† (Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ±ÛŒÙ†)</option>
                    <option value="time-desc">Ø²Ù…Ø§Ù† (Ø¯ÙˆØ±ØªØ±ÛŒÙ†)</option>
                    <option value="name-asc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (Ø§Ù„Ù-ÛŒ)</option>
                    <option value="name-desc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (ÛŒ-Ø§Ù„Ù)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">ÙÛŒÙ„ØªØ± Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs transition ${sessionFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                      onClick={() => setSessionFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}
                    >
                      Ù‡Ù…Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§
                    </button>
                    {sessionScheduleOptions.map((s) => {
                      const active = sessionFilterDraft.scheduleIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                          onClick={() =>
                            setSessionFilterDraft((prev) => ({
                              ...prev,
                              scheduleIds: active
                                ? prev.scheduleIds.filter((id) => id !== s.id)
                                : [...prev.scheduleIds, s.id],
                            }))
                          }
                        >
                          {s.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={sessionFilterDraft.includePast}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, includePast: e.target.checked }))}
                  />
                  Ù†Ù…Ø§ÛŒØ´ Ø¬Ù„Ø³Ø§Øª Ú¯Ø°Ø´ØªÙ‡
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setSessionFilters(sessionFilterDraft);
                      setSessionFilterOpen(false);
                    }}
                  >
                    Ø§Ø¹Ù…Ø§Ù„ ÙÛŒÙ„ØªØ±
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setSessionFilterDraft(defaultListFilters);
                      setSessionFilters(defaultListFilters);
                      setSessionFilterOpen(false);
                    }}
                  >
                    Ø±ÛŒØ³Øª
                  </button>
                </div>
              </div>
            )}
          </div>
          {nextSession && nextSession.timeSlot?.startTime && (
            <div className="mb-4 rounded-xl border border-cyan-700/40 bg-cyan-500/10 p-3 text-sm text-cyan-200">
              <div className="font-semibold">Ø¬Ù„Ø³Ù‡ Ø¨Ø¹Ø¯ÛŒ Ø´Ù…Ø§</div>
              <div className="mt-1 text-xs text-slate-300">
                {highlightText(nextSession.schedule?.title || "Ø¬Ù„Ø³Ù‡", sessionFilters.query)} Â· {formatJalaliDateTime(new Date(nextSession.timeSlot.startTime))}
              </div>
              {minutesUntil(new Date(nextSession.timeSlot.startTime)) >= 0 && (
                <div className="mt-1 text-xs text-slate-300">
                  Ø´Ø±ÙˆØ¹ ØªØ§ {minutesUntil(new Date(nextSession.timeSlot.startTime))} Ø¯Ù‚ÛŒÙ‚Ù‡ Ø¯ÛŒÚ¯Ø±
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {filteredMySessions.length === 0 && <div className="text-sm text-slate-400">Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ ÙÛŒÙ„ØªØ± Ø§Ù†ØªØ®Ø§Ø¨ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.</div>}
            {filteredMySessions.map((s) => (
              <div key={s.id} className="rounded-xl surface-block p-3">
                <div className="font-medium break-words">{highlightText(s.schedule?.title || "-", sessionFilters.query)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    src={s.schedule?.user?.avatarUrl}
                    alt="host avatar"
                    sizeClassName="h-8 w-8"
                    iconSize={14}
                    onClick={() => openAvatarPreview(s.schedule?.user?.avatarUrl, s.schedule?.user?.username || s.schedule?.user?.phone || "Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡")}
                  />
                  <div className="text-sm text-slate-400">Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡: {highlightText(s.schedule?.user?.username || s.schedule?.user?.phone || "-", sessionFilters.query)}</div>
                </div>
                <div className="text-sm text-slate-400">
                  Ø²Ù…Ø§Ù† Ø´Ø±ÙˆØ¹: {s.timeSlot?.startTime ? formatJalaliDateTime(new Date(s.timeSlot.startTime)) : "-"}
                </div>
                <div className="text-sm text-slate-400">
                  Ø²Ù…Ø§Ù† Ù¾Ø§ÛŒØ§Ù†: {s.timeSlot?.endTime ? formatJalaliDateTime(new Date(s.timeSlot.endTime)) : "-"}
                </div>
                <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
                  <div className="mb-2 text-xs text-slate-400">Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ ÙØ±Ù…</div>
                  {renderAnswers(s.answers, s.schedule?.questions, sessionFilters.query)}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setCancelTarget(s)}
                    aria-label="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ"
                    title="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ"
                  >
                    <XCircle size={14} className="icon-danger" />
                    <span>Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "profile" && (
        <section className="card space-y-4 p-4 md:mt-2">
          <h2 className="text-lg font-bold md:text-xl">Ù¾Ø±ÙˆÙØ§ÛŒÙ„</h2>
          <p className="text-sm text-slate-400">Ù…Ø¯ÛŒØ±ÛŒØª Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒØŒ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±ØŒ Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ùˆ Ø­Ø°Ù Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ.</p>
          <div className="space-y-3">
            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("username")}
                aria-expanded={profileSections.username}
              >
                ØªØºÛŒÛŒØ± Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒ
                <ChevronDown size={16} className={`transition ${profileSections.username ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${profileSections.username ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <form
                  className="space-y-2 overflow-hidden px-4 pb-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setProfileLoading(true);
                    const res = await fetch("/api/profile", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ username: profileUsername }),
                    });
                    const data = await res.json();
                    setProfileLoading(false);
                    if (!res.ok) return toast.error(data.details || data.error || "Ø®Ø·Ø§");
                    queryClient.setQueryData(["auth", "me"], data);
                    toast.success("Ù¾Ø±ÙˆÙØ§ÛŒÙ„ Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯");
                  }}
                >
                  <label className="block text-sm text-slate-300">Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒ</label>
                  <input className="input" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} />
                  <button className="btn-primary" disabled={profileLoading}>{profileLoading ? "Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡..." : "Ø°Ø®ÛŒØ±Ù‡ Ù†Ø§Ù… Ú©Ø§Ø±Ø¨Ø±ÛŒ"}</button>
                </form>
              </div>
            </div>

            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("avatar")}
                aria-expanded={profileSections.avatar}
              >
                Ø¹Ú©Ø³ Ù¾Ø±ÙˆÙØ§ÛŒÙ„
                <ChevronDown size={16} className={`transition ${profileSections.avatar ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${profileSections.avatar ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden px-4 pb-4">
                  <AvatarUploader
                    currentAvatarUrl={user?.avatarUrl}
                    onPreview={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "Ú©Ø§Ø±Ø¨Ø±")}
                    onUploaded={(avatarUrl) => {
                      queryClient.setQueryData(["auth", "me"], (prev: any) => ({ ...(prev || {}), avatarUrl }));
                      bumpAvatarRefreshToken();
                      void Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
                        queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
                        queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
                      ]);
                    }}
                    onRemoved={() => {
                      queryClient.setQueryData(["auth", "me"], (prev: any) => ({ ...(prev || {}), avatarUrl: null }));
                      bumpAvatarRefreshToken();
                      void Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
                        queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
                        queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
                      ]);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("password")}
                aria-expanded={profileSections.password}
              >
                ØªØºÛŒÛŒØ± Ø±Ù…Ø² Ø¹Ø¨ÙˆØ±
                <ChevronDown size={16} className={`transition ${profileSections.password ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${profileSections.password ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="space-y-2 overflow-hidden px-4 pb-4">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      if (requestingPasswordOtp || passwordOtpCooldown > 0) return;
                      try {
                        setRequestingPasswordOtp(true);
                        const res = await fetch("/api/profile/password/request-otp", { method: "POST" });
                        const data = await res.json();
                        if (!res.ok) {
                          const msg = data.details || data.error || "Ø®Ø·Ø§";
                          const match = String(msg).match(/(\d+)/);
                          if (match) setPasswordOtpCooldown(Number(match[1]));
                          return toast.error(msg);
                        }
                        setPasswordOtpCooldown(120);
                        toast.success("Ú©Ø¯ ØªØ§ÛŒÛŒØ¯ Ø§Ø±Ø³Ø§Ù„ Ø´Ø¯");
                      } finally {
                        setRequestingPasswordOtp(false);
                      }
                    }}
                    disabled={requestingPasswordOtp || passwordOtpCooldown > 0}
                  >
                    {requestingPasswordOtp ? "Ø¯Ø± Ø­Ø§Ù„ Ø§Ø±Ø³Ø§Ù„..." : passwordOtpCooldown > 0 ? `Ø§Ø±Ø³Ø§Ù„ Ù…Ø¬Ø¯Ø¯ ØªØ§ ${passwordOtpCooldown} Ø«Ø§Ù†ÛŒÙ‡` : "Ø§Ø±Ø³Ø§Ù„ Ú©Ø¯ ØªØ§ÛŒÛŒØ¯"}
                  </button>
                  <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
                  <input className="input" type="tel" inputMode="numeric" pattern="[0-9Û°-Û¹Ù -Ù©]*" autoComplete="one-time-code" placeholder="Ú©Ø¯ ØªØ§ÛŒÛŒØ¯" value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} />
                  <div className="relative">
                    <input className="input ps-10" type={showNewPassword ? "text" : "password"} placeholder="Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowNewPassword((p) => !p)}>
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input className="input ps-10" type={showConfirmPassword ? "text" : "password"} placeholder="ØªÚ©Ø±Ø§Ø± Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø¬Ø¯ÛŒØ¯" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                    <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowConfirmPassword((p) => !p)}>
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    className="btn-primary"
                    onClick={async () => {
                      const res = await fetch("/api/profile/password/confirm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: passwordCode, newPassword, confirmPassword: confirmNewPassword }),
                      });
                      const data = await res.json();
                      if (!res.ok) return toast.error(data.details || data.error || "Ø®Ø·Ø§");
                      toast.success("Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± ØªØºÛŒÛŒØ± Ú©Ø±Ø¯");
                      setPasswordCode("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                  >
                    ØªØ§ÛŒÛŒØ¯ ØªØºÛŒÛŒØ± Ø±Ù…Ø²
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium text-rose-200"
                onClick={() => toggleProfileSection("delete")}
                aria-expanded={profileSections.delete}
              >
                Ø­Ø°Ù Ø§Ú©Ø§Ù†Øª
                <ChevronDown size={16} className={`transition ${profileSections.delete ? "rotate-180" : ""}`} />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${profileSections.delete ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden px-4 pb-4">
                  <button className="btn-danger" onClick={() => setDeleteAccountOpen(true)}>
                    Ø­Ø°Ù Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="card space-y-4 p-4 md:mt-2">
          <h2 className="text-lg font-bold md:text-xl">ØªÙ†Ø¸ÛŒÙ…Ø§Øª</h2>
          <p className="text-sm text-slate-400">Ú©Ù†ØªØ±Ù„ Ø¯Ø±ÛŒØ§ÙØª Ù¾ÛŒØ§Ù…Ú©â€ŒÙ‡Ø§ÛŒ Ù…Ø±Ø¨ÙˆØ· Ø¨Ù‡ Ø±Ø²Ø±ÙˆÙ‡Ø§ Ùˆ Ø¬Ù„Ø³Ø§Øª.</p>

          <div className="space-y-3">
            <div className="rounded-2xl surface-block p-4">
              <h3 className="text-sm font-semibold text-slate-200">Ù¾ÛŒØ§Ù…Ú©â€ŒÙ‡Ø§ÛŒ Ø±Ø²Ø±Ùˆ</h3>
              <p className="mt-1 text-xs text-slate-400">Ø¨Ø§ Ø®Ø§Ù…ÙˆØ´ Ú©Ø±Ø¯Ù† Ù‡Ø± Ú¯Ø²ÛŒÙ†Ù‡ØŒ Ù¾ÛŒØ§Ù…Ú© Ù…Ø±Ø¨ÙˆØ·Ù‡ Ø¨Ø±Ø§ÛŒ Ø´Ù…Ø§ Ø§Ø±Ø³Ø§Ù„ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯.</p>
              <div className="mt-3 space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">Ø±Ø²Ø±Ùˆ Ø¬Ø¯ÛŒØ¯</span>
                    <span className="block text-xs text-slate-400">Ø§Ø·Ù„Ø§Ø¹â€ŒØ±Ø³Ø§Ù†ÛŒ Ø«Ø¨Øª Ø±Ø²Ø±Ùˆ Ø¬Ø¯ÛŒØ¯</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={smsPreferences.bookingCreated}
                    onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingCreated: e.target.checked })}
                    disabled={smsPreferencesSaving}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">Ú©Ù†Ø³Ù„ Ø´Ø¯Ù† Ø±Ø²Ø±Ùˆ</span>
                    <span className="block text-xs text-slate-400">Ø§Ø·Ù„Ø§Ø¹â€ŒØ±Ø³Ø§Ù†ÛŒ Ù„ØºÙˆ Ø±Ø²Ø±Ùˆ</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={smsPreferences.bookingCanceled}
                    onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingCanceled: e.target.checked })}
                    disabled={smsPreferencesSaving}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">ÛŒØ§Ø¯Ø¢ÙˆØ±ÛŒ Ø¬Ù„Ø³Ù‡</span>
                    <span className="block text-xs text-slate-400">Û±Û° Ø¯Ù‚ÛŒÙ‚Ù‡ Ù‚Ø¨Ù„ Ø§Ø² Ø´Ø±ÙˆØ¹ Ø¬Ù„Ø³Ù‡</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={smsPreferences.bookingReminder}
                    onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingReminder: e.target.checked })}
                    disabled={smsPreferencesSaving}
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {smsPreferencesSaving && <span className="text-cyan-200">Ø¯Ø± Ø­Ø§Ù„ Ø°Ø®ÛŒØ±Ù‡ ØªÙ†Ø¸ÛŒÙ…Ø§Øª...</span>}
                {smsPreferencesError && <span className="text-rose-300">{smsPreferencesError}</span>}
              </div>
            </div>
          </div>
        </section>
      )}

      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">ØªØ£ÛŒÛŒØ¯ Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ</h3>
            <p className="mt-2 text-sm text-slate-300">
              Ù…Ø·Ù…Ø¦Ù† Ù‡Ø³ØªÛŒØ¯ Ú©Ù‡ Ù…ÛŒâ€ŒØ®ÙˆØ§Ù‡ÛŒØ¯ Ø§ÛŒÙ† Ø±Ø²Ø±Ùˆ Ø±Ø§ Ú©Ù†Ø³Ù„ Ú©Ù†ÛŒØ¯ØŸ
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Ø¨Ø±Ù†Ø§Ù…Ù‡: {cancelTarget.schedule?.title || "-"}
            </p>
            <p className="text-xs text-slate-400">
              Ø²Ù…Ø§Ù†: {new Date(cancelTarget.timeSlot?.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)} disabled={cancelLoading}>
                Ø§Ù†ØµØ±Ø§Ù
              </button>
              <button type="button" className="btn-danger" onClick={cancelBooking} disabled={cancelLoading}>
                {cancelLoading ? "Ø¯Ø± Ø­Ø§Ù„ Ú©Ù†Ø³Ù„..." : "Ø¨Ù„Ù‡ØŒ Ú©Ù†Ø³Ù„ Ú©Ù†"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteScheduleTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">ØªØ£ÛŒÛŒØ¯ Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡</h3>
            <p className="mt-2 text-sm text-slate-300">
              Ø¨Ø§ Ø­Ø°Ù Ø¨Ø±Ù†Ø§Ù…Ù‡ØŒ ØªÙ…Ø§Ù… Ø±Ø²Ø±ÙˆÙ‡Ø§ Ùˆ Ø¨Ø§Ø²Ù‡â€ŒÙ‡Ø§ÛŒ Ø§ÛŒÙ† Ø¨Ø±Ù†Ø§Ù…Ù‡ Ù‡Ù… Ø­Ø°Ù Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯. Ø§Ø¯Ø§Ù…Ù‡ Ù…ÛŒâ€ŒØ¯Ù‡ÛŒØ¯ØŸ
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Ø¹Ù†ÙˆØ§Ù† Ø¨Ø±Ù†Ø§Ù…Ù‡: {deleteScheduleTarget.title || "-"}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteScheduleTarget(null)}
                disabled={deletingSchedule}
              >
                Ø§Ù†ØµØ±Ø§Ù
              </button>
              <button type="button" className="btn-danger" onClick={deleteSchedule} disabled={deletingSchedule}>
                {deletingSchedule ? "Ø¯Ø± Ø­Ø§Ù„ Ø­Ø°Ù..." : "Ø¨Ù„Ù‡ØŒ Ø­Ø°Ù Ú©Ù†"}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4" onClick={() => setQrModal(null)}>
          <div className="card w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ Ø¨Ø±Ù†Ø§Ù…Ù‡</h3>
            <p className="mt-1 text-sm text-slate-400">{qrModal.schedule?.title || "Ø¨Ø±Ù†Ø§Ù…Ù‡"}</p>
            <a className="mt-2 block break-all text-xs text-cyan-300" href={qrModal.url} target="_blank" rel="noreferrer">
              {qrModal.url}
            </a>
            <div className="mt-4 flex items-center justify-center rounded-2xl bg-white p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="h-48 w-48" />
              ) : (
                <div className="text-xs text-slate-500">Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª QR...</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {qrDataUrl && (
                <a className="btn-ghost" href={qrDataUrl} download={`bookhub-${qrModal.schedule?.shareId || "schedule"}.png`}>
                  <Download size={16} /> Ø¯Ø§Ù†Ù„ÙˆØ¯ QR
                </a>
              )}
              <button type="button" className="btn-primary" onClick={shareQrLink}>
                <Share2 size={16} /> Ø§Ø´ØªØ±Ø§Ú©â€ŒÚ¯Ø°Ø§Ø±ÛŒ
              </button>
              <button type="button" className="btn-ghost" onClick={() => setQrModal(null)}>Ø¨Ø³ØªÙ†</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 md:hidden">
        <div className="relative card mx-auto grid max-w-md grid-cols-5 gap-2 overflow-hidden p-2">
          <div 
            className="absolute bottom-0 left-0 h-1 rounded-t-full bg-cyan-500 transition-all duration-300 ease-out"
            style={{
              width: `${100 / tabOrder.length}%`,
              transform: `translateX(${tabOrder.indexOf(tab) * 100}%)`,
            }}
          />
          
          <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("schedules")}>
            <CalendarDays size={15} />
          </button>
          <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("bookings")}>
            <ListChecks size={15} />
          </button>
          <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("sessions")}>
            <Clock3 size={15} />
          </button>
          <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("profile")}>
            <UserCircle2 size={15} />
          </button>
          <button className={`btn ${tab === "settings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("settings")}>
            <Settings size={15} />
          </button>
        </div>
      </nav>

      {avatarPreview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" onClick={() => setAvatarPreview(null)}>
          <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">{avatarPreview.name}</h3>
            <Image
              src={avatarPreview.url}
              alt={avatarPreview.name}
              width={1200}
              height={900}
              className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain"
              unoptimized
            />
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setAvatarPreview(null)}>Ø¨Ø³ØªÙ†</button>
            </div>
          </div>
        </div>
      )}

      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[82] grid place-items-center bg-slate-950/80 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">Ø­Ø°Ù Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ</h3>
            <p className="mt-2 text-sm text-slate-300">Ø§ÛŒÙ† Ø¹Ù…Ù„ÛŒØ§Øª Ù‚Ø§Ø¨Ù„ Ø¨Ø§Ø²Ú¯Ø´Øª Ù†ÛŒØ³Øª. Ø§Ø¯Ø§Ù…Ù‡ Ù…ÛŒâ€ŒØ¯Ù‡ÛŒØ¯ØŸ</p>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                className="btn-ghost w-full justify-between"
                onClick={async () => {
                  if (requestingDeleteOtp || deleteOtpCooldown > 0) return;
                  try {
                    setRequestingDeleteOtp(true);
                    const res = await fetch("/api/profile/delete/request-otp", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      const msg = data.details || data.error || "Ø®Ø·Ø§";
                      const match = String(msg).match(/(\d+)/);
                      if (match) setDeleteOtpCooldown(Number(match[1]));
                      return toast.error(msg);
                    }
                    setDeleteOtpCooldown(120);
                    toast.success("Ú©Ø¯ ØªØ§ÛŒÛŒØ¯ Ø§Ø±Ø³Ø§Ù„ Ø´Ø¯");
                  } finally {
                    setRequestingDeleteOtp(false);
                  }
                }}
                disabled={requestingDeleteOtp || deleteOtpCooldown > 0}
              >
                {requestingDeleteOtp
                  ? "Ø¯Ø± Ø­Ø§Ù„ Ø§Ø±Ø³Ø§Ù„..."
                  : deleteOtpCooldown > 0
                    ? `Ø§Ø±Ø³Ø§Ù„ Ù…Ø¬Ø¯Ø¯ ØªØ§ ${deleteOtpCooldown} Ø«Ø§Ù†ÛŒÙ‡`
                    : "Ø§Ø±Ø³Ø§Ù„ Ú©Ø¯ ØªØ§ÛŒÛŒØ¯ Ø­Ø°Ù"}
              </button>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9Û°-Û¹Ù -Ù©]*"
                autoComplete="one-time-code"
                placeholder="Ú©Ø¯ ØªØ§ÛŒÛŒØ¯ Û¶ Ø±Ù‚Ù…ÛŒ"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setDeleteAccountOpen(false)}>Ø§Ù†ØµØ±Ø§Ù</button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
                    if (!deleteCode.trim()) return toast.error("Ú©Ø¯ ØªØ§ÛŒÛŒØ¯ Ø±Ø§ ÙˆØ§Ø±Ø¯ Ú©Ù†ÛŒØ¯");
                    setDeletingAccount(true);
                    const res = await fetch("/api/profile/delete/confirm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ code: deleteCode }),
                    });
                    setDeletingAccount(false);
                    const data = await res.json();
                    if (!res.ok) return toast.error(data.details || data.error || "Ø­Ø°Ù Ø­Ø³Ø§Ø¨ Ù†Ø§Ù…ÙˆÙÙ‚ Ø¨ÙˆØ¯");
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? "Ø¯Ø± Ø­Ø§Ù„ Ø­Ø°Ù..." : "ØªØ§ÛŒÛŒØ¯ Ø­Ø°Ù"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

