"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

type Question = { label: string; type: "text" | "textarea"; required: boolean };

export default function DashboardPage() {
  const [tab, setTab] = useState<"schedules" | "bookings">("schedules");
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [scheduleFilter, setScheduleFilter] = useState("");

  const [selectedDates, setSelectedDates] = useState<any[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  async function load() {
    const me = await fetch("/api/auth/me");
    if (!me.ok) return (window.location.href = "/login");
    setUser((await me.json()).user);

    const sch = await fetch("/api/schedules/my");
    const schData = await sch.json();
    setSchedules(schData);

    const bk = await fetch(`/api/bookings/my${scheduleFilter ? `?scheduleId=${scheduleFilter}` : ""}`);
    setBookings(await bk.json());
  }

  useEffect(() => {
    void load();
  }, [scheduleFilter]);

  const daysConfig = useMemo(
    () =>
      selectedDates.map((d: any) => {
        const g = d.toDate();
        const yyyy = g.getFullYear();
        const mm = String(g.getMonth() + 1).padStart(2, "0");
        const dd = String(g.getDate()).padStart(2, "0");
        return { date: `${yyyy}-${mm}-${dd}` };
      }),
    [selectedDates],
  );

  async function createSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);

    if (daysConfig.length === 0) {
      return toast.error("حداقل یک تاریخ انتخاب کنید");
    }

    const startTime = String(f.get("startTime"));
    const endTime = String(f.get("endTime"));

    const payload = {
      title: String(f.get("title")),
      slotDuration: Number(f.get("slotDuration")),
      gapMinutes: Number(f.get("gapMinutes")),
      daysConfig: daysConfig.map((d) => ({ ...d, startTime, endTime })),
      questions: questions.filter((q) => q.label.trim().length > 0),
    };

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "خطا");

    toast.success("برنامه ساخته شد");
    setSelectedDates([]);
    setQuestions([]);
    (e.currentTarget as HTMLFormElement).reset();
    await load();
  }

  function addQuestion() {
    if (questions.length >= 5) return;
    setQuestions((prev) => [...prev, { label: "", type: "text", required: false }]);
  }

  function updateQuestion(index: number, key: keyof Question, value: string | boolean) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, [key]: value } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="card p-5">
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <p className="mt-1 text-slate-600">{user ? `${user.username} عزیز خوش آمدید` : "..."}</p>
      </div>

      <div className="flex gap-2">
        <button className={`btn ${tab === "schedules" ? "bg-sky-600 text-white" : "border"}`} onClick={() => setTab("schedules")}>برنامه‌های من</button>
        <button className={`btn ${tab === "bookings" ? "bg-sky-600 text-white" : "border"}`} onClick={() => setTab("bookings")}>رزروهای من</button>
      </div>

      {tab === "schedules" && (
        <section className="grid gap-4 md:grid-cols-2">
          <form onSubmit={createSchedule} className="card space-y-4 p-4">
            <h2 className="font-bold">ساخت برنامه جدید</h2>
            <input className="input" name="title" placeholder="عنوان برنامه" required />

            <div>
              <label className="mb-2 block text-sm">انتخاب تاریخ‌ها (چندتایی)</label>
              <DatePicker
                multiple
                calendar={persian}
                locale={persian_fa}
                value={selectedDates}
                onChange={(v: any) => setSelectedDates(Array.isArray(v) ? v : v ? [v] : [])}
                inputClass="input"
                calendarPosition="bottom-right"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input className="input" name="startTime" type="time" required />
              <input className="input" name="endTime" type="time" required />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input className="input" name="slotDuration" type="number" min={10} defaultValue={30} placeholder="مدت هر ارائه (دقیقه)" required />
              <input className="input" name="gapMinutes" type="number" min={0} defaultValue={10} placeholder="فاصله بین ارائه‌ها (دقیقه)" required />
            </div>

            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">سوالات فرم رزرو</p>
                <button type="button" className="btn border" onClick={addQuestion} disabled={questions.length >= 5}>افزودن سوال</button>
              </div>

              {questions.map((q, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-2">
                  <input className="input" placeholder={`متن سوال ${i + 1}`} value={q.label} onChange={(e) => updateQuestion(i, "label", e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <select className="input" value={q.type} onChange={(e) => updateQuestion(i, "type", e.target.value as "text" | "textarea") }>
                      <option value="text">متن کوتاه</option>
                      <option value="textarea">متن بلند</option>
                    </select>
                    <label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                      <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, "required", e.target.checked)} />
                      الزامی
                    </label>
                  </div>
                  <button type="button" className="btn border" onClick={() => removeQuestion(i)}>حذف سوال</button>
                </div>
              ))}
            </div>

            <button className="btn-primary w-full">ایجاد برنامه</button>
          </form>

          <div className="space-y-3">
            {schedules.map((s) => (
              <div className="card p-4" key={s.id}>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  لینک اشتراک: <a className="text-sky-600" href={`/schedule/${s.shareId}`}>{`/schedule/${s.shareId}`}</a>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "bookings" && (
        <section className="card p-4">
          <select className="input mb-4 max-w-sm" value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
            <option value="">همه برنامه‌ها</option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="rounded-xl border p-3">
                <div className="font-medium">{b.schedule.title}</div>
                <div className="text-sm text-slate-600">نام رزروکننده: {b.visitorName || "-"}</div>
                <div className="text-sm text-slate-600">زمان: {new Date(b.timeSlot.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</div>
                <div className="text-sm">پاسخ‌ها: {Array.isArray(b.answers) ? b.answers.join(" | ") : "-"}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
