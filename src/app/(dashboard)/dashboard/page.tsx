"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
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
  Pencil,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  ShieldCheck,
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

type Question = { label: string; type: "text" | "textarea"; required: boolean };
type Range = { startTime: string; endTime: string };
type DayItem = { date: string; ranges: Range[] };

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
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<any | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [showCreateFormMobile, setShowCreateFormMobile] = useState(false);
  const [isScheduleMenuOpen, setIsScheduleMenuOpen] = useState(false);
  const scheduleMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [requestingPasswordOtp, setRequestingPasswordOtp] = useState(false);
  const [passwordCode, setPasswordCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<{ url: string; name: string } | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    queryKey: ["bookings", "my", scheduleFilter],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/my${scheduleFilter ? `?scheduleId=${scheduleFilter}` : ""}`, { cache: "no-store" });
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
      if (!scheduleMenuRef.current) return;
      if (!scheduleMenuRef.current.contains(e.target as Node)) {
        setIsScheduleMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const isInvalidTimeConfig = useMemo(() => dayConfigs.some((d) => rangesOverlap(d.ranges)), [dayConfigs]);
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

    if (dayConfigs.length === 0) return toast.error("حداقل یک تاریخ انتخاب کنید");
    if (dayConfigs.some((d) => d.date < todayTehranYmd)) return toast.error("تاریخ برنامه نباید قبل از امروز باشد");
    if (dayConfigs.some((d) => d.ranges.length === 0)) return toast.error("برای هر تاریخ حداقل یک بازه زمانی لازم است");
    if (isInvalidTimeConfig) return toast.error("تداخل یا نامعتبر بودن بازه‌های زمانی را اصلاح کنید");

    const payload = {
      title: String(f.get("title")),
      slotDuration: Number(f.get("slotDuration")),
      gapMinutes: Number(f.get("gapMinutes")),
      daysConfig: dayConfigs,
      questions: questions.filter((q) => q.label.trim().length > 0),
    };

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return toast.error(data.details || data.error || "خطا");

    queryClient.setQueryData(["schedules", "my"], (prev: any) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const exists = prevList.some((item: any) => item?.id === data?.id);
      if (exists) return prevList;
      return [data, ...prevList];
    });

    toast.success("برنامه ساخته شد");
    setSelectedDates([]);
    setDayConfigs([]);
    setQuestions([]);
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
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden p-4 pb-[calc(96px+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <UserAvatar
            src={user?.avatarUrl}
            alt="avatar"
            sizeClassName="h-10 w-10"
            iconSize={16}
            onClick={() => {
              const url = normalizePreviewUrl(user?.avatarUrl);
              if (!url) return;
              setAvatarPreview({ url, name: user.username || user.phone || "کاربر" });
            }}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-bold md:text-2xl">داشبورد رزرو</h1>
            <p className="mt-1 text-sm text-slate-400">{user ? `${user.username || user.phone} عزیز خوش آمدید` : "..."}</p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <button type="button" className="btn-ghost h-11 w-11 p-0" onClick={toggleTheme} aria-label="تغییر تم">
              {theme === "dark" ? <Sun size={24} strokeWidth={2.25} /> : <Moon size={24} strokeWidth={2.25} />}
            </button>
            <button onClick={logout} className="btn-ghost h-10 px-3" aria-label="خروج" title="خروج">
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

            <div>
              <label className="mb-2 block text-sm text-slate-300">عنوان برنامه</label>
              <input className="input" name="title" placeholder="مثلاً مشاوره پایان‌نامه" required />
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
                <input className="input" name="slotDuration" type="number" min={5} defaultValue={30} required />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">فاصله بین ارائه‌ها (دقیقه)</label>
                <input className="input" name="gapMinutes" type="number" min={0} defaultValue={10} required />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-800 p-3">
              <p className="text-sm text-slate-300">بازه‌های زمانی هر تاریخ</p>
              {dayConfigs.map((d) => (
                <div key={d.date} className="rounded-xl border border-slate-800 p-3">
                  <div className="mb-2 text-sm text-cyan-300">{toJalaliLabel(d.date)}</div>
                  <div className="space-y-2">
                    {d.ranges.map((r, i) => (
                      <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">شروع</label>
                          <input className="input min-w-0" type="time" value={r.startTime} onChange={(e) => updateRange(d.date, i, "startTime", e.target.value)} />
                        </div>
                        <div className="min-w-0">
                          <label className="mb-1 block text-xs text-slate-400">پایان</label>
                          <input className="input min-w-0" type="time" value={r.endTime} onChange={(e) => updateRange(d.date, i, "endTime", e.target.value)} />
                        </div>
                        <button type="button" className="btn-ghost w-full sm:w-auto sm:self-end" onClick={() => removeRange(d.date, i)}><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost mt-2" onClick={() => addRange(d.date)}><Plus size={16} /> افزودن بازه</button>
                </div>
              ))}
              {isInvalidTimeConfig && <p className="text-sm text-rose-300">در بعضی تاریخ‌ها تداخل یا ترتیب نادرست بازه وجود دارد.</p>}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">سوالات فرم رزرو</p>
                <button type="button" className="btn-ghost" onClick={addQuestion} disabled={questions.length >= 5}><Plus size={16} /> افزودن سوال</button>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-slate-800 p-2">
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
                      <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-700 px-3 text-sm">
                        <ShieldCheck size={15} className="text-cyan-300" />
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

            <button className="btn-primary w-full"><Clock3 size={16} /> ایجاد برنامه</button>
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
          <label className="mb-2 block text-sm text-slate-300">فیلتر بر اساس برنامه</label>
          <div ref={scheduleMenuRef} className="relative mb-4 w-full sm:max-w-sm">
            <button
              type="button"
              onClick={() => setIsScheduleMenuOpen((prev) => !prev)}
              className="dropdown-trigger flex w-full items-center justify-between rounded-3xl px-3 py-2.5 text-right shadow-sm outline-none transition"
              aria-haspopup="listbox"
              aria-expanded={isScheduleMenuOpen}
            >
              <span className="truncate">
                {scheduleFilter ? schedules.find((s) => s.id === scheduleFilter)?.title || "همه برنامه‌ها" : "همه برنامه‌ها"}
              </span>
              <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${isScheduleMenuOpen ? "rotate-180" : ""}`} />
            </button>

            <div
              className={`dropdown-panel absolute z-50 mt-2 max-h-64 w-full origin-top overflow-y-auto rounded-2xl shadow-xl transition-all duration-200 ${
                isScheduleMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"
              }`}
            >
              <button
                type="button"
                className={`dropdown-option block w-full px-3 py-2 text-right text-sm transition ${scheduleFilter === "" ? "dropdown-option-active" : ""}`}
                onClick={() => {
                  setScheduleFilter("");
                  setIsScheduleMenuOpen(false);
                }}
                role="option"
                aria-selected={scheduleFilter === ""}
              >
                همه برنامه‌ها
              </button>
              {schedules.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`dropdown-option block w-full px-3 py-2 text-right text-sm transition ${scheduleFilter === s.id ? "dropdown-option-active" : ""}`}
                  onClick={() => {
                    setScheduleFilter(s.id);
                    setIsScheduleMenuOpen(false);
                  }}
                  role="option"
                  aria-selected={scheduleFilter === s.id}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {bookings.length === 0 && <div className="text-sm text-slate-400">برای این برنامه رزروی ثبت نشده است.</div>}
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-800 p-3">
                <div className="font-medium break-words">{b.schedule.title}</div>
                <div className="text-sm text-slate-400">نام رزروکننده: {b.visitorName || "-"}</div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    src={b.bookedByUser?.avatarUrl}
                    alt="booker avatar"
                    sizeClassName="h-8 w-8"
                    iconSize={14}
                    onClick={() => {
                      const url = normalizePreviewUrl(b.bookedByUser?.avatarUrl);
                      if (!url) return;
                      setAvatarPreview({ url, name: b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر" });
                    }}
                  />
                  <div className="text-xs text-slate-400">{b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر مهمان"}</div>
                </div>
                <div className="text-sm text-slate-400">زمان: {new Date(b.timeSlot.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</div>
                <div className="mt-2 space-y-1 text-sm text-slate-300 break-words">
                  {Array.isArray(b.answers) && Array.isArray(b.schedule?.questions) && b.schedule.questions.length > 0 ? (
                    b.schedule.questions.map((q: any, idx: number) => (
                      <div key={idx}>
                        {q?.label || `سوال ${idx + 1}`}: {b.answers[idx] || "-"}
                      </div>
                    ))
                  ) : (
                    <div>پاسخ‌ها: {Array.isArray(b.answers) ? b.answers.join(" | ") || "-" : "-"}</div>
                  )}
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    className="btn-ghost"
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
          <div className="space-y-3">
            {mySessions.length === 0 && <div className="text-sm text-slate-400">هنوز جلسه‌ای رزرو نکرده‌اید.</div>}
            {mySessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-800 p-3">
                <div className="font-medium break-words">{s.schedule?.title || "-"}</div>
                <div className="mt-2 flex items-center gap-2">
                  <UserAvatar
                    src={s.schedule?.user?.avatarUrl}
                    alt="host avatar"
                    sizeClassName="h-8 w-8"
                    iconSize={14}
                    onClick={() => {
                      const url = normalizePreviewUrl(s.schedule?.user?.avatarUrl);
                      if (!url) return;
                      setAvatarPreview({ url, name: s.schedule?.user?.username || s.schedule?.user?.phone || "ارائه‌دهنده" });
                    }}
                  />
                  <div className="text-sm text-slate-400">ارائه‌دهنده: {s.schedule?.user?.username || s.schedule?.user?.phone || "-"}</div>
                </div>
                <div className="text-sm text-slate-400">
                  زمان شروع: {new Date(s.timeSlot?.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
                </div>
                <div className="text-sm text-slate-400">
                  زمان پایان: {new Date(s.timeSlot?.endTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-300 break-words">
                  {Array.isArray(s.answers) && Array.isArray(s.schedule?.questions) && s.schedule.questions.length > 0 ? (
                    s.schedule.questions.map((q: any, idx: number) => (
                      <div key={idx}>
                        {q?.label || `سوال ${idx + 1}`}: {s.answers[idx] || "-"}
                      </div>
                    ))
                  ) : (
                    <div>پاسخ‌ها: {Array.isArray(s.answers) ? s.answers.join(" | ") || "-" : "-"}</div>
                  )}
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

          <form
            className="space-y-2"
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

          <AvatarUploader
            currentAvatarUrl={user?.avatarUrl}
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

          <div className="rounded-xl border border-slate-800 p-3 space-y-2">
            <h3 className="font-medium">تغییر رمز عبور</h3>
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                if (requestingPasswordOtp) return;
                try {
                  setRequestingPasswordOtp(true);
                  const res = await fetch("/api/profile/password/request-otp", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) return toast.error(data.details || data.error || "خطا");
                  toast.success("کد تایید ارسال شد");
                } finally {
                  setRequestingPasswordOtp(false);
                }
              }}
              disabled={requestingPasswordOtp}
            >
              {requestingPasswordOtp ? "در حال ارسال..." : "ارسال کد تایید"}
            </button>
            <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
            <input className="input" placeholder="کد تایید" value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} />
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

          <button className="btn-ghost" onClick={() => setDeleteAccountOpen(true)}>
            حذف حساب کاربری
          </button>
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
              <button type="button" className="btn-ghost" onClick={cancelBooking} disabled={cancelLoading}>
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
              <button type="button" className="btn-ghost" onClick={deleteSchedule} disabled={deletingSchedule}>
                {deletingSchedule ? "در حال حذف..." : "بله، حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 md:hidden">
        <div className="card mx-auto grid max-w-md grid-cols-4 gap-2 p-2">
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
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setDeleteAccountOpen(false)}>انصراف</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={async () => {
                  const res = await fetch("/api/profile", { method: "DELETE" });
                  if (!res.ok) return toast.error("حذف حساب ناموفق بود");
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                تایید حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
