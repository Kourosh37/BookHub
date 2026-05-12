"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import {
  CalendarDays,
  Clock3,
  Copy,
  ListChecks,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type Question = { label: string; type: "text" | "textarea"; required: boolean };
type Range = { startTime: string; endTime: string };
type DayItem = { date: string; ranges: Range[] };

function toYmd(dateObj: any) {
  if (!dateObj) return "";
  return new DateObject(dateObj).convert(gregorian).format("YYYY-MM-DD");
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

export default function DashboardPage() {
  const [tab, setTab] = useState<"schedules" | "bookings" | "sessions">("schedules");
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [scheduleFilter, setScheduleFilter] = useState("");

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

  useEffect(() => {
    if (typeof window !== "undefined") setBaseUrl(window.location.origin.replace(/\/$/, ""));
  }, []);

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me", { cache: "no-store" });
    if (!me.ok) return (window.location.href = "/login");
    setUser((await me.json()).user);

    const sch = await fetch("/api/schedules/my", { cache: "no-store" });
    setSchedules(await sch.json());

    const bk = await fetch(`/api/bookings/my${scheduleFilter ? `?scheduleId=${scheduleFilter}` : ""}`, { cache: "no-store" });
    setBookings(await bk.json());

    const mine = await fetch("/api/bookings/mine", { cache: "no-store" });
    setMySessions(await mine.json());
  }, [scheduleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDayConfigs((prev) => {
      const map = new Map(prev.map((d) => [d.date, d]));
      return selectedDates.map((d) => map.get(d) || { date: d, ranges: [{ startTime: "10:00", endTime: "13:00" }] });
    });
  }, [selectedDates]);

  const isInvalidTimeConfig = useMemo(() => dayConfigs.some((d) => rangesOverlap(d.ranges)), [dayConfigs]);
  const pickerValue = useMemo(() => selectedDates.map((d) => ymdToPersianDateObject(d)), [selectedDates]);

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

    toast.success("برنامه ساخته شد");
    setSelectedDates([]);
    setDayConfigs([]);
    setQuestions([]);
    (e.currentTarget as HTMLFormElement).reset();
    await load();
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
    await load();
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

    setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? { ...s, title: data.title } : s)));
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

    setSchedules((prev) => prev.filter((s) => s.id !== deleteScheduleTarget.id));
    if (scheduleFilter === deleteScheduleTarget.id) setScheduleFilter("");
    toast.success("برنامه حذف شد");
    setDeleteScheduleTarget(null);
    await load();
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden p-4 md:p-6">
      <div className="card p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold md:text-2xl">داشبورد رزرو</h1>
            <p className="mt-1 text-sm text-slate-400">{user ? `${user.username} عزیز خوش آمدید` : "..."}</p>
          </div>
          <button onClick={logout} className="btn-ghost ms-auto text-rose-300">
            <LogOut size={16} /> خروج
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("schedules")}>
          <CalendarDays size={16} /> برنامه‌های من
        </button>
        <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("bookings")}>
          <ListChecks size={16} /> رزروهای من
        </button>
        <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setTab("sessions")}>
          <Clock3 size={16} /> جلسات من
        </button>
      </div>

      {tab === "schedules" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={createSchedule} className="card space-y-4 p-4 md:p-5">
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
                        backgroundColor: "#0ea5e9",
                        color: "#082f49",
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
                      <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">شروع</label>
                          <input className="input" type="time" value={r.startTime} onChange={(e) => updateRange(d.date, i, "startTime", e.target.value)} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">پایان</label>
                          <input className="input" type="time" value={r.endTime} onChange={(e) => updateRange(d.date, i, "endTime", e.target.value)} />
                        </div>
                        <button type="button" className="btn-ghost sm:self-end" onClick={() => removeRange(d.date, i)}><Trash2 size={16} /></button>
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

          <div className="space-y-3">
            {schedules.map((s) => (
              <div className="card p-4" key={s.id}>
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
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold break-words">{s.title}</h3>
                    <button type="button" className="btn-ghost text-xs" onClick={() => startEditScheduleTitle(s)}>
                      ویرایش نام
                    </button>
                  </div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <a className="text-cyan-300 break-all" href={getShareUrl(s.shareId)}>{getShareUrl(s.shareId)}</a>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(getShareUrl(s.shareId));
                      toast.success("لینک کپی شد");
                    }}
                  >
                    <Copy size={14} /> کپی لینک
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-rose-300"
                    onClick={() => setDeleteScheduleTarget(s)}
                  >
                    <Trash2 size={14} /> حذف برنامه
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "bookings" && (
        <section className="card p-4">
          <label className="mb-2 block text-sm text-slate-300">فیلتر بر اساس برنامه</label>
          <select className="input mb-4 w-full sm:max-w-sm" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="">همه برنامه‌ها</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-800 p-3">
                <div className="font-medium break-words">{b.schedule.title}</div>
                <div className="text-sm text-slate-400">نام رزروکننده: {b.visitorName || "-"}</div>
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
                    className="btn-ghost text-rose-300"
                    onClick={() => setCancelTarget(b)}
                  >
                    کنسل رزرو
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "sessions" && (
        <section className="card p-4">
          <div className="space-y-3">
            {mySessions.length === 0 && <div className="text-sm text-slate-400">هنوز جلسه‌ای رزرو نکرده‌اید.</div>}
            {mySessions.map((s) => (
              <div key={s.id} className="rounded-xl border border-slate-800 p-3">
                <div className="font-medium break-words">{s.schedule?.title || "-"}</div>
                <div className="text-sm text-slate-400">ارائه‌دهنده: {s.schedule?.user?.username || "-"}</div>
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
              <button type="button" className="btn-ghost text-rose-300" onClick={cancelBooking} disabled={cancelLoading}>
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
              <button
                type="button"
                className="btn-ghost text-rose-300"
                onClick={deleteSchedule}
                disabled={deletingSchedule}
              >
                {deletingSchedule ? "در حال حذف..." : "بله، حذف کن"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
