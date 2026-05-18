"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
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
        label: q?.label || `سوال ${idx + 1}`,
        value: Array.isArray(answers) ? answers[idx] : "-",
      }))
    : Array.isArray(answers)
      ? answers.map((value: any, idx: number) => ({ label: `پاسخ ${idx + 1}`, value }))
      : [];

  if (items.length === 0) {
    return <div className="text-xs text-slate-400">پاسخی ثبت نشده است.</div>;
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
      issues[item.idx] = "زمان پایان باید بعد از زمان شروع باشد.";
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.s < prev.e) {
      issues[cur.idx] = issues[cur.idx] || "این بازه با بازه قبلی همپوشانی دارد.";
      issues[prev.idx] = issues[prev.idx] || "این بازه با بازه بعدی همپوشانی دارد.";
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
  const scheduleFilter = useUIStore((s) => s.scheduleFilter);
  const setScheduleFilter = useUIStore((s) => s.setScheduleFilter);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const bumpAvatarRefreshToken = useUIStore((s) => s.bumpAvatarRefreshToken);

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
  const [bookingFilters, setBookingFilters] = useState<ListFilterState>({
    query: "",
    from: "",
    to: "",
    includePast: false,
    scheduleIds: [],
    sort: "time-asc",
  });
  const [bookingFilterDraft, setBookingFilterDraft] = useState<ListFilterState>({
    query: "",
    from: "",
    to: "",
    includePast: false,
    scheduleIds: [],
    sort: "time-asc",
  });
  const [bookingFilterOpen, setBookingFilterOpen] = useState(false);
  const [sessionFilters, setSessionFilters] = useState<ListFilterState>({
    query: "",
    from: "",
    to: "",
    includePast: false,
    scheduleIds: [],
    sort: "time-asc",
  });
  const [sessionFilterDraft, setSessionFilterDraft] = useState<ListFilterState>({
    query: "",
    from: "",
    to: "",
    includePast: false,
    scheduleIds: [],
    sort: "time-asc",
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

  function openQrForCurrentSchedule() {
    if (schedules.length === 0) {
      toast.error("ابتدا یک برنامه بسازید");
      return;
    }
    const selected = scheduleFilter
      ? schedules.find((s: any) => s.id === scheduleFilter)
      : schedules[0];
    if (!selected) {
      toast.error("برنامه‌ای برای اشتراک پیدا نشد");
      return;
    }
    openQrModal(selected);
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
        // fall through to clipboard
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

  async function captureExportPng() {
    if (!bookingsExportRef.current) throw new Error("NO_EXPORT_TARGET");
    const now = new Date();
    setExportContext(buildExportContext(now));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const { toPng } = await import("html-to-image");
    return toPng(bookingsExportRef.current, {
      cacheBust: true,
      pixelRatio: 2.5,
      backgroundColor: "#f8fafc",
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
      toast.error("خروجی تصویر ناموفق بود");
    } finally {
      setExportingImage(false);
      setIsExportMenuOpen(false);
    }
  }

  async function exportBookingsAsPdf() {
    setExportingPdf(true);
    try {
      const dataUrl = await captureExportPng();
      const img = new window.Image();
      img.src = dataUrl;
      await img.decode();
      const { jsPDF } = await import("jspdf");
      const orientation = img.width > img.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "pt", format: [img.width, img.height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      const fileStamp = getExportFileStamp(new Date());
      pdf.save(`bookings-${fileStamp}.pdf`);
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

    if (scheduleFilter === deleteScheduleTarget.id) setScheduleFilter("");
    toast.success("برنامه حذف شد");
    setDeleteScheduleTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
    ]);
  }

  return (
    <main className="page-shell w-full space-y-6 overflow-x-hidden py-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:py-6 md:pb-6">
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <UserAvatar
            src={user?.avatarUrl}
            alt="avatar"
            sizeClassName="h-10 w-10"
            iconSize={16}
            onClick={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "کاربر")}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold md:text-2xl">داشبورد رزرو</h1>
            <p className="mt-1 text-sm text-slate-400">{user ? `${user.username || user.phone} عزیز خوش آمدید` : "مدیریت زمان‌بندی، رزروها و پروفایل"}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={toggleTheme} aria-label="تغییر تم">
              {theme === "dark" ? <Sun strokeWidth={2.25} /> : <Moon strokeWidth={2.25} />}
            </button>
            <button onClick={logout} className="btn-danger header-action-btn px-3" aria-label="خروج" title="خروج">
              <LogOut size={18} className="icon-danger" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 md:flex">
        <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("schedules")}>
          <CalendarDays size={16} /> برنامه‌های من
        </button>
        <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("bookings")}>
          <ListChecks size={16} /> رزروهای من
        </button>
        <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("sessions")}>
          <Clock3 size={16} /> جلسات من
        </button>
        <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("profile")}>
          <UserCircle2 size={16} /> پروفایل
        </button>
      </div>

      {tab === "schedules" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <h2 className="text-lg font-bold md:text-xl">برنامه‌های من</h2>
            <p className="mt-1 text-sm text-slate-400">برنامه‌های زمانی خود را بسازید، ویرایش کنید و لینک رزرو هر برنامه را مدیریت کنید.</p>
          </div>
          <div className="md:hidden">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => setShowCreateFormMobile((prev) => !prev)}
            >
              <Plus size={16} /> {showCreateFormMobile ? "بستن فرم برنامه جدید" : "برنامه جدید"}
            </button>
          </div>

          <form
            onSubmit={createSchedule}
            className={`card space-y-4 p-4 md:p-5 ${showCreateFormMobile ? "block" : "hidden md:block"}`}
          >
            <h2 className="font-bold">ساخت برنامه جدید</h2>
            {createError && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                {createError}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm text-slate-300">عنوان برنامه</label>
              <input
                className="input"
                name="title"
                placeholder="مثلاً مشاوره پایان‌نامه"
                value={scheduleTitle}
                onChange={(e) => setScheduleTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">انتخاب تاریخ‌ها</label>
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
                    <span className="flex items-center gap-2"><CalendarDays size={16} /> {selectedDates.length > 0 ? `${selectedDates.length} تاریخ انتخاب شده` : "انتخاب تاریخ"}</span>
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
                <label className="mb-2 block text-sm text-slate-300">مدت هر ارائه (دقیقه)</label>
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
                <label className="mb-2 block text-sm text-slate-300">فاصله بین ارائه‌ها (دقیقه)</label>
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
              <p className="text-sm text-slate-300">بازه‌های زمانی هر تاریخ</p>
              <p className="text-xs text-slate-400">هر بازه باید حداقل به اندازه مدت جلسه باشد تا اسلات تولید شود.</p>
              <p className="text-xs text-slate-400">فاصله بین ارائه‌ها باید عددی غیرمنفی باشد؛ اگر خیلی بزرگ باشد ممکن است تنها یک اسلات بسازد.</p>
              <p className="text-xs text-slate-400">جمع کل اسلات‌های قابل تولید: {totalSlotCount}</p>
              {totalSlotCount === 0 && (
                <p className="text-xs text-rose-300">هیچ اسلاتی تولید نمی‌شود. بازه‌ها یا مدت جلسه را اصلاح کنید.</p>
              )}
              {totalSlotCount > 0 && totalSlotCount < 3 && (
                <p className="text-xs text-amber-200">اسلات‌های کمی تولید می‌شوند؛ ممکن است نیاز به بازه بیشتر داشته باشید.</p>
              )}
              {!canCreateSchedule && (
                <p className="text-xs text-rose-300">تا زمان اصلاح بازه‌ها امکان ساخت برنامه وجود ندارد.</p>
              )}
              {dayConfigs.map((d) => (
                <div key={d.date} className="rounded-xl surface-block p-3">
                  <div className="mb-2 text-sm text-cyan-300">{toJalaliLabel(d.date)}</div>
                  {rangeIssuesByDate.get(d.date)?.some(Boolean) && (
                    <p className="mb-2 text-xs text-rose-300">حداقل یکی از بازه‌های این تاریخ مشکل دارد.</p>
                  )}
                  {(slotCountByDate.get(d.date) ?? 0) === 0 && (
                    <p className="mb-2 text-xs text-rose-300">برای این تاریخ اسلاتی تولید نمی‌شود.</p>
                  )}
                  {(slotCountByDate.get(d.date) ?? 0) > 0 && (slotCountByDate.get(d.date) ?? 0) < 2 && (
                    <p className="mb-2 text-xs text-amber-200">فقط یک اسلات برای این تاریخ ساخته می‌شود.</p>
                  )}
                  <div className="space-y-2">
                    {d.ranges.map((r, i) => (
                      <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <div className="md:col-span-3 text-xs text-slate-400">
                          طول بازه: {getRangeLengthMinutes(r)} دقیقه
                          {slotDurationMinutes > 0 && getRangeLengthMinutes(r) < slotDurationMinutes && (
                            <span className="text-rose-300"> · کوتاه‌تر از مدت جلسه است</span>
                          )}
                          {slotDurationMinutes > 0 && getRangeLengthMinutes(r) === slotDurationMinutes && (
                            <span className="text-amber-200"> · فقط یک جلسه جا می‌شود</span>
                          )}
                          {gapMinutesValue > 0 && getRangeLengthMinutes(r) <= slotDurationMinutes + gapMinutesValue && (
                            <span className="text-amber-200"> · فاصله بزرگ است و احتمالاً فقط یک اسلات می‌سازد</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">شروع</label>
                          <input
                            className={`input time-input min-w-0 ${rangeIssuesByDate.get(d.date)?.[i] ? "border-rose-400/70 ring-2 ring-rose-400/30" : ""}`}
                            type="time"
                            value={r.startTime}
                            onChange={(e) => updateRange(d.date, i, "startTime", e.target.value)}
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">پایان</label>
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
                  <button type="button" className="btn-ghost mt-2" onClick={() => addRange(d.date)}><Plus size={16} /> افزودن بازه</button>
                </div>
              ))}
              {isInvalidTimeConfig && <p className="text-sm text-rose-300">در بعضی تاریخ‌ها تداخل یا ترتیب نادرست بازه وجود دارد.</p>}
              {createError && !isInvalidTimeConfig && (
                <p className="text-sm text-rose-300">{createError}</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl surface-block p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">سوالات فرم رزرو</p>
                <button type="button" className="btn-ghost" onClick={addQuestion} disabled={questions.length >= 5}><Plus size={16} /> افزودن سوال</button>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-lg surface-block p-2">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label="حذف سوال"
                      title="حذف سوال"
                    >
                      <Trash2 size={14} className="icon-danger" />
                      <span>حذف سوال</span>
                    </button>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">متن سوال</label>
                    <input
                      className="input"
                      placeholder={`متن سوال ${i + 1}`}
                      value={q.label}
                      onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">نوع پاسخ</label>
                      <select
                        className="input"
                        value={q.type}
                        onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, type: e.target.value as "text" | "textarea" } : x)))}
                      >
                        <option value="text">متن کوتاه</option>
                        <option value="textarea">متن بلند</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">الزامی بودن</label>
                      <label className="flex h-11 items-center gap-2 rounded-xl surface-block px-3 text-sm">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, required: e.target.checked } : x)))}
                        />
                        اجباری
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn-primary w-full" disabled={!canCreateSchedule || creatingSchedule}>
              <Clock3 size={16} /> {creatingSchedule ? "در حال ساخت..." : "ایجاد برنامه"}
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {schedules.map((s) => (
              <div className="card p-4 transition hover:-translate-y-0.5 hover:border-cyan-700" key={s.id}>
                {editingScheduleId === s.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs text-slate-400">ویرایش نام برنامه</label>
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
                        {savingTitle ? "در حال ذخیره..." : "ذخیره"}
                      </button>
                      <button type="button" className="btn-ghost" onClick={stopEditScheduleTitle} disabled={savingTitle}>
                        انصراف
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold break-words text-base">{s.title}</h3>
                      <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-1 text-xs text-cyan-200">
                        برنامه
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })
                        : "تاریخ نامشخص"}
                    </p>
                  </div>
                )}
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <a className="block text-cyan-300 break-all" href={getShareUrl(s.shareId)}>{getShareUrl(s.shareId)}</a>
                  <div className="flex flex-wrap gap-2">
                    {editingScheduleId !== s.id && (
                      <button type="button" className="btn-ghost" onClick={() => startEditScheduleTitle(s)} aria-label="ویرایش نام برنامه" title="ویرایش نام برنامه">
                        <Pencil size={14} />
                        <span className="hidden md:inline">ویرایش نام</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={async () => {
                        await navigator.clipboard.writeText(getShareUrl(s.shareId));
                        toast.success("لینک کپی شد");
                      }}
                      aria-label="کپی لینک برنامه"
                      title="کپی لینک برنامه"
                    >
                      <Copy size={14} />
                      <span className="hidden md:inline">کپی لینک</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => openQrModal(s)}
                      aria-label="نمایش QR برنامه"
                      title="نمایش QR برنامه"
                    >
                      <QrCode size={14} />
                      <span className="hidden md:inline">QR برنامه</span>
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDeleteScheduleTarget(s)}
                      aria-label="حذف برنامه"
                      title="حذف برنامه"
                    >
                      <Trash2 size={14} className="icon-danger" />
                      <span className="hidden md:inline">حذف برنامه</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "bookings" && (
        <section className="card relative overflow-visible p-4">
          <h2 className="mb-4 text-lg font-bold md:text-xl">رزروهای من</h2>
          <p className="-mt-2 mb-4 text-sm text-slate-400">لیست رزروهایی که دیگران روی برنامه‌های شما ثبت کرده‌اند را ببینید و در صورت نیاز کنسل کنید.</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-sm text-slate-300">فیلتر بر اساس برنامه</label>
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                className="btn-ghost flex items-center gap-2"
                aria-haspopup="listbox"
                aria-expanded={isExportMenuOpen}
              >
                <Download size={16} /> خروجی گرفتن
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
                  <FileText size={14} /> {exportingPdf ? "در حال ساخت PDF" : "PDF"}
                </button>
                <button
                  type="button"
                  className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition"
                  onClick={exportBookingsAsImage}
                  disabled={exportingImage}
                >
                  <FileImage size={14} /> {exportingImage ? "در حال ساخت تصویر" : "تصویر"}
                </button>
              </div>
            </div>
          </div>
          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="input h-10"
              placeholder="جستجو در رزروها (نام، شماره، پاسخ‌ها...)"
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
              فیلتر بیشتر
            </button>
            {bookingFilterOpen && (
              <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">از تاریخ</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={bookingFilterDraft.from}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">تا تاریخ</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={bookingFilterDraft.to}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">مرتب‌سازی</label>
                  <select
                    className="input h-10"
                    value={bookingFilterDraft.sort}
                    onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}
                  >
                    <option value="time-asc">زمان (نزدیک‌ترین)</option>
                    <option value="time-desc">زمان (دورترین)</option>
                    <option value="name-asc">نام برنامه (الف-ی)</option>
                    <option value="name-desc">نام برنامه (ی-الف)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">فیلتر برنامه‌ها</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs transition ${bookingFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                      onClick={() => setBookingFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}
                    >
                      همه برنامه‌ها
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
                  نمایش رزروهای گذشته
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
                    اعمال فیلتر
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const reset = { query: "", from: "", to: "", includePast: false, scheduleIds: [], sort: "time-asc" };
                      setBookingFilterDraft(reset);
                      setBookingFilters(reset);
                      setBookingFilterOpen(false);
                    }}
                  >
                    ریست
                  </button>
                </div>
              </div>
            )}
          </div>
          <div
            ref={bookingsExportRef}
            className="fixed left-[-9999px] top-0 w-[980px]"
            aria-hidden="true"
          >
            <div
              className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 text-slate-900 shadow-xl"
              dir="rtl"
              style={{ fontFamily: "Vazirmatn, ui-sans-serif, system-ui" }}
            >
              <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div>
                  <div className="text-lg font-extrabold">خروجی رزروها</div>
                  <div className="text-xs text-slate-500">{exportContext.title} · {exportContext.count} رزرو</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-slate-500">زمان دانلود: {exportContext.stamp}</div>
                  <img src="/logo.svg" alt="BookHub" className="h-8 w-8" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <table className="w-full border-separate border-spacing-0 text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="rounded-tr-2xl border-b border-slate-200 p-2 text-right">برنامه</th>
                      <th className="border-b border-slate-200 p-2 text-right">رزروکننده</th>
                      <th className="border-b border-slate-200 p-2 text-right">شماره</th>
                      <th className="rounded-tl-2xl border-b border-slate-200 p-2 text-right">زمان</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((b, idx) => (
                      <tr key={b.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="border-b border-slate-100 p-2">{b.schedule?.title || "-"}</td>
                        <td className="border-b border-slate-100 p-2">{b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر"}</td>
                        <td className="border-b border-slate-100 p-2" dir="ltr">{b.bookedByUser?.phone || "-"}</td>
                        <td className="border-b border-slate-100 p-2">{b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                <span>bookhub.ir</span>
                <span>رزروهای ثبت‌شده شما</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {filteredBookings.length === 0 && <div className="text-sm text-slate-400">نتیجه‌ای برای فیلتر انتخابی پیدا نشد.</div>}
            {filteredBookings.map((b) => (
              <div key={b.id} className="rounded-xl surface-block p-3">
                <div className="font-medium break-words">{highlightText(b.schedule.title, bookingFilters.query)}</div>
                <div className="text-sm text-slate-400">
                  نام رزروکننده: {highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر", bookingFilters.query)}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <span>شماره رزروکننده:</span>
                  <span dir="ltr">{highlightText(b.bookedByUser?.phone || "-", bookingFilters.query)}</span>
                  {b.bookedByUser?.phone && (
                    <button
                      type="button"
                      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-500/10 hover:text-cyan-300"
                      onClick={async () => {
                        await navigator.clipboard.writeText(b.bookedByUser.phone);
                        toast.success("شماره کپی شد");
                      }}
                      aria-label="کپی شماره رزروکننده"
                      title="کپی شماره رزروکننده"
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
                    onClick={() => openAvatarPreview(b.bookedByUser?.avatarUrl, b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر")}
                  />
                  <div className="text-xs text-slate-400">{highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر مهمان", bookingFilters.query)}</div>
                </div>
                <div className="text-sm text-slate-400">
                  زمان: {b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}
                </div>
                <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
                  <div className="mb-2 text-xs text-slate-400">پاسخ‌های فرم</div>
                  {renderAnswers(b.answers, b.schedule?.questions, bookingFilters.query)}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setCancelTarget(b)}
                    aria-label="کنسل رزرو"
                    title="کنسل رزرو"
                  >
                    <XCircle size={14} className="icon-danger" />
                    <span>کنسل رزرو</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "sessions" && (
        <section className="card p-4">
          <h2 className="mb-4 text-lg font-bold md:text-xl">جلسات من</h2>
          <p className="-mt-2 mb-4 text-sm text-slate-400">جلسه‌هایی که خودتان رزرو کرده‌اید همراه با زمان و پاسخ‌های ثبت‌شده نمایش داده می‌شوند.</p>
          <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="input h-10"
              placeholder="جستجو در جلسات (نام برنامه، ارائه‌دهنده، پاسخ‌ها...)"
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
              فیلتر بیشتر
            </button>
            {sessionFilterOpen && (
              <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">از تاریخ</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={sessionFilterDraft.from}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, from: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">تا تاریخ</label>
                  <input
                    className="input h-10"
                    type="date"
                    value={sessionFilterDraft.to}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, to: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">مرتب‌سازی</label>
                  <select
                    className="input h-10"
                    value={sessionFilterDraft.sort}
                    onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}
                  >
                    <option value="time-asc">زمان (نزدیک‌ترین)</option>
                    <option value="time-desc">زمان (دورترین)</option>
                    <option value="name-asc">نام برنامه (الف-ی)</option>
                    <option value="name-desc">نام برنامه (ی-الف)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">فیلتر برنامه‌ها</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs transition ${sessionFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`}
                      onClick={() => setSessionFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}
                    >
                      همه برنامه‌ها
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
                  نمایش جلسات گذشته
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
                    اعمال فیلتر
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const reset = { query: "", from: "", to: "", includePast: false, scheduleIds: [], sort: "time-asc" };
                      setSessionFilterDraft(reset);
                      setSessionFilters(reset);
                      setSessionFilterOpen(false);
                    }}
                  >
                    ریست
                  </button>
                </div>
              </div>
            )}
          </div>
          {nextSession && nextSession.timeSlot?.startTime && (
            <div className="mb-4 rounded-xl border border-cyan-700/40 bg-cyan-500/10 p-3 text-sm text-cyan-200">
              <div className="font-semibold">جلسه بعدی شما</div>
              <div className="mt-1 text-xs text-slate-300">
                {highlightText(nextSession.schedule?.title || "جلسه", sessionFilters.query)} · {formatJalaliDateTime(new Date(nextSession.timeSlot.startTime))}
              </div>
              {minutesUntil(new Date(nextSession.timeSlot.startTime)) >= 0 && (
                <div className="mt-1 text-xs text-slate-300">
                  شروع تا {minutesUntil(new Date(nextSession.timeSlot.startTime))} دقیقه دیگر
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {filteredMySessions.length === 0 && <div className="text-sm text-slate-400">نتیجه‌ای برای فیلتر انتخابی پیدا نشد.</div>}
            {filteredMySessions.map((s) => (
              <div key={s.id} className="rounded-xl surface-block p-3">
                <div className="font-medium break-words">{highlightText(s.schedule?.title || "-", sessionFilters.query)}</div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    src={s.schedule?.user?.avatarUrl}
                    alt="host avatar"
                    sizeClassName="h-8 w-8"
                    iconSize={14}
                    onClick={() => openAvatarPreview(s.schedule?.user?.avatarUrl, s.schedule?.user?.username || s.schedule?.user?.phone || "ارائه‌دهنده")}
                  />
                  <div className="text-sm text-slate-400">ارائه‌دهنده: {highlightText(s.schedule?.user?.username || s.schedule?.user?.phone || "-", sessionFilters.query)}</div>
                </div>
                <div className="text-sm text-slate-400">
                  زمان شروع: {s.timeSlot?.startTime ? formatJalaliDateTime(new Date(s.timeSlot.startTime)) : "-"}
                </div>
                <div className="text-sm text-slate-400">
                  زمان پایان: {s.timeSlot?.endTime ? formatJalaliDateTime(new Date(s.timeSlot.endTime)) : "-"}
                </div>
                <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
                  <div className="mb-2 text-xs text-slate-400">پاسخ‌های فرم</div>
                  {renderAnswers(s.answers, s.schedule?.questions, sessionFilters.query)}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => setCancelTarget(s)}
                    aria-label="کنسل رزرو"
                    title="کنسل رزرو"
                  >
                    <XCircle size={14} className="icon-danger" />
                    <span>کنسل رزرو</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "profile" && (
        <section className="card space-y-4 p-4">
          <h2 className="text-lg font-bold md:text-xl">پروفایل</h2>
          <p className="text-sm text-slate-400">مدیریت نام کاربری، رمز عبور، عکس پروفایل و حذف حساب کاربری.</p>
          <div className="space-y-3">
            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("username")}
                aria-expanded={profileSections.username}
              >
                تغییر نام کاربری
                <ChevronDown size={16} className={`transition ${profileSections.username ? "rotate-180" : ""}`} />
              </button>
              {profileSections.username && (
                <form
                  className="space-y-2 px-4 pb-4"
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
                    if (!res.ok) return toast.error(data.details || data.error || "خطا");
                    queryClient.setQueryData(["auth", "me"], data);
                    toast.success("پروفایل به‌روزرسانی شد");
                  }}
                >
                  <label className="block text-sm text-slate-300">نام کاربری</label>
                  <input className="input" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} />
                  <button className="btn-primary" disabled={profileLoading}>{profileLoading ? "در حال ذخیره..." : "ذخیره نام کاربری"}</button>
                </form>
              )}
            </div>

            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("avatar")}
                aria-expanded={profileSections.avatar}
              >
                عکس پروفایل
                <ChevronDown size={16} className={`transition ${profileSections.avatar ? "rotate-180" : ""}`} />
              </button>
              {profileSections.avatar && (
                <div className="px-4 pb-4">
                  <AvatarUploader
                    currentAvatarUrl={user?.avatarUrl}
                    onPreview={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "کاربر")}
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
              )}
            </div>

            <div className="rounded-2xl surface-block">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium"
                onClick={() => toggleProfileSection("password")}
                aria-expanded={profileSections.password}
              >
                تغییر رمز عبور
                <ChevronDown size={16} className={`transition ${profileSections.password ? "rotate-180" : ""}`} />
              </button>
              {profileSections.password && (
                <div className="space-y-2 px-4 pb-4">
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
                          const msg = data.details || data.error || "خطا";
                          const match = String(msg).match(/(\d+)/);
                          if (match) setPasswordOtpCooldown(Number(match[1]));
                          return toast.error(msg);
                        }
                        setPasswordOtpCooldown(120);
                        toast.success("کد تایید ارسال شد");
                      } finally {
                        setRequestingPasswordOtp(false);
                      }
                    }}
                    disabled={requestingPasswordOtp || passwordOtpCooldown > 0}
                  >
                    {requestingPasswordOtp ? "در حال ارسال..." : passwordOtpCooldown > 0 ? `ارسال مجدد تا ${passwordOtpCooldown} ثانیه` : "ارسال کد تایید"}
                  </button>
                  <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
                  <input className="input" type="tel" inputMode="numeric" pattern="[0-9۰-۹٠-٩]*" autoComplete="one-time-code" placeholder="کد تایید" value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} />
                  <div className="relative">
                    <input className="input ps-10" type={showNewPassword ? "text" : "password"} placeholder="رمز عبور جدید" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowNewPassword((p) => !p)}>
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="relative">
                    <input className="input ps-10" type={showConfirmPassword ? "text" : "password"} placeholder="تکرار رمز عبور جدید" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
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
                      if (!res.ok) return toast.error(data.details || data.error || "خطا");
                      toast.success("رمز عبور تغییر کرد");
                      setPasswordCode("");
                      setNewPassword("");
                      setConfirmNewPassword("");
                    }}
                  >
                    تایید تغییر رمز
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium text-rose-200"
                onClick={() => toggleProfileSection("delete")}
                aria-expanded={profileSections.delete}
              >
                حذف اکانت
                <ChevronDown size={16} className={`transition ${profileSections.delete ? "rotate-180" : ""}`} />
              </button>
              {profileSections.delete && (
                <div className="px-4 pb-4">
                  <button className="btn-danger" onClick={() => setDeleteAccountOpen(true)}>
                    حذف حساب کاربری
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">تأیید کنسل رزرو</h3>
            <p className="mt-2 text-sm text-slate-300">
              مطمئن هستید که می‌خواهید این رزرو را کنسل کنید؟
            </p>
            <p className="mt-2 text-xs text-slate-400">
              برنامه: {cancelTarget.schedule?.title || "-"}
            </p>
            <p className="text-xs text-slate-400">
              زمان: {new Date(cancelTarget.timeSlot?.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setCancelTarget(null)} disabled={cancelLoading}>
                انصراف
              </button>
              <button type="button" className="btn-danger" onClick={cancelBooking} disabled={cancelLoading}>
                {cancelLoading ? "در حال کنسل..." : "بله، کنسل کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteScheduleTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">تأیید حذف برنامه</h3>
            <p className="mt-2 text-sm text-slate-300">
              با حذف برنامه، تمام رزروها و بازه‌های این برنامه هم حذف می‌شوند. ادامه می‌دهید؟
            </p>
            <p className="mt-2 text-xs text-slate-400">
              عنوان برنامه: {deleteScheduleTarget.title || "-"}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteScheduleTarget(null)}
                disabled={deletingSchedule}
              >
                انصراف
              </button>
              <button type="button" className="btn-danger" onClick={deleteSchedule} disabled={deletingSchedule}>
                {deletingSchedule ? "در حال حذف..." : "بله، حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModal && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/80 p-4" onClick={() => setQrModal(null)}>
          <div className="card w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">اشتراک‌گذاری برنامه</h3>
            <p className="mt-1 text-sm text-slate-400">{qrModal.schedule?.title || "برنامه"}</p>
            <a className="mt-2 block break-all text-xs text-cyan-300" href={qrModal.url} target="_blank" rel="noreferrer">
              {qrModal.url}
            </a>
            <div className="mt-4 flex items-center justify-center rounded-2xl bg-white p-3">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR" className="h-48 w-48" />
              ) : (
                <div className="text-xs text-slate-500">در حال ساخت QR...</div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {qrDataUrl && (
                <a className="btn-ghost" href={qrDataUrl} download={`bookhub-${qrModal.schedule?.shareId || "schedule"}.png`}>
                  <Download size={16} /> دانلود QR
                </a>
              )}
              <button type="button" className="btn-primary" onClick={shareQrLink}>
                <Share2 size={16} /> اشتراک‌گذاری
              </button>
              <button type="button" className="btn-ghost" onClick={() => setQrModal(null)}>بستن</button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 md:hidden">
        <div className="card mx-auto grid max-w-md grid-cols-5 gap-2 p-2">
          <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("schedules")}>
            <CalendarDays size={15} />
          </button>
          <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("bookings")}>
            <ListChecks size={15} />
          </button>
          <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("sessions")}>
            <Clock3 size={15} />
          </button>
          <button className="btn-ghost" onClick={openQrForCurrentSchedule} aria-label="اشتراک با QR">
            <QrCode size={15} />
          </button>
          <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("profile")}>
            <UserCircle2 size={15} />
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
              <button type="button" className="btn-ghost" onClick={() => setAvatarPreview(null)}>بستن</button>
            </div>
          </div>
        </div>
      )}

      {deleteAccountOpen && (
        <div className="fixed inset-0 z-[82] grid place-items-center bg-slate-950/80 p-4">
          <div className="card w-full max-w-md p-4">
            <h3 className="text-lg font-bold">حذف حساب کاربری</h3>
            <p className="mt-2 text-sm text-slate-300">این عملیات قابل بازگشت نیست. ادامه می‌دهید؟</p>
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
                      const msg = data.details || data.error || "خطا";
                      const match = String(msg).match(/(\d+)/);
                      if (match) setDeleteOtpCooldown(Number(match[1]));
                      return toast.error(msg);
                    }
                    setDeleteOtpCooldown(120);
                    toast.success("کد تایید ارسال شد");
                  } finally {
                    setRequestingDeleteOtp(false);
                  }
                }}
                disabled={requestingDeleteOtp || deleteOtpCooldown > 0}
              >
                {requestingDeleteOtp
                  ? "در حال ارسال..."
                  : deleteOtpCooldown > 0
                    ? `ارسال مجدد تا ${deleteOtpCooldown} ثانیه`
                    : "ارسال کد تایید حذف"}
              </button>
              <input
                className="input"
                type="tel"
                inputMode="numeric"
                pattern="[0-9۰-۹٠-٩]*"
                autoComplete="one-time-code"
                placeholder="کد تایید ۶ رقمی"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={() => setDeleteAccountOpen(false)}>انصراف</button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={async () => {
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
                  }}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? "در حال حذف..." : "تایید حذف"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
