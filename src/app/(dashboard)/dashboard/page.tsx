"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
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
  const g = dateObj.toDate();
  const yyyy = g.getFullYear();
  const mm = String(g.getMonth() + 1).padStart(2, "0");
  const dd = String(g.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const [tab, setTab] = useState<"schedules" | "bookings">("schedules");
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [scheduleFilter, setScheduleFilter] = useState("");

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [dayConfigs, setDayConfigs] = useState<DayItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  const load = useCallback(async () => {
    const me = await fetch("/api/auth/me", { cache: "no-store" });
    if (!me.ok) return (window.location.href = "/login");
    setUser((await me.json()).user);

    const sch = await fetch("/api/schedules/my", { cache: "no-store" });
    setSchedules(await sch.json());

    const bk = await fetch(`/api/bookings/my${scheduleFilter ? `?scheduleId=${scheduleFilter}` : ""}`, { cache: "no-store" });
    setBookings(await bk.json());
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
                value={selectedDates}
                onChange={(v: any) => {
                  const arr = Array.isArray(v) ? v : v ? [v] : [];
                  setSelectedDates(arr.map((x: any) => toYmd(x)));
                }}
                inputClass="input"
                calendarPosition="bottom-right"
              />
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
                  <div className="mb-2 text-sm text-cyan-300">{d.date}</div>
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
                <h3 className="font-semibold break-words">{s.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <a className="text-cyan-300 break-all" href={`/schedule/${s.shareId}`}>{`/schedule/${s.shareId}`}</a>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`${window.location.origin}/schedule/${s.shareId}`);
                      toast.success("لینک کپی شد");
                    }}
                  >
                    <Copy size={14} /> کپی لینک
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
                <div className="text-sm text-slate-300 break-words">پاسخ‌ها: {Array.isArray(b.answers) ? b.answers.join(" | ") : "-"}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
