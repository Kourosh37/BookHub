"use client";
import { FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";

const weekdayOptions = [
  { v: 0, l: "یکشنبه" },
  { v: 1, l: "دوشنبه" },
  { v: 2, l: "سه‌شنبه" },
  { v: 3, l: "چهارشنبه" },
  { v: 4, l: "پنجشنبه" },
  { v: 5, l: "جمعه" },
  { v: 6, l: "شنبه" },
];

export default function DashboardPage() {
  const [tab, setTab] = useState<"schedules" | "bookings">("schedules");
  const [user, setUser] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [scheduleFilter, setScheduleFilter] = useState("");

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
    load();
  }, [scheduleFilter]);

  async function createSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const daysConfig = [
      {
        dayOfWeek: Number(f.get("dayOfWeek")),
        startTime: String(f.get("startTime")),
        endTime: String(f.get("endTime")),
      },
    ];
    const questions = String(f.get("question") || "").trim()
      ? [{ label: String(f.get("question")), type: "text", required: false }]
      : [];

    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.get("title"), daysConfig, questions }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || "خطا");
    toast.success("برنامه ساخته شد");
    await load();
  }

  return <main className="mx-auto max-w-6xl p-6 space-y-6"><div className="card p-5"><h1 className="text-2xl font-bold">داشبورد</h1><p className="text-slate-600 mt-1">{user ? `${user.username} عزیز خوش آمدید` : "..."}</p></div><div className="flex gap-2"><button className={`btn ${tab==="schedules"?"bg-sky-600 text-white":"border"}`} onClick={()=>setTab("schedules")}>برنامه‌های من</button><button className={`btn ${tab==="bookings"?"bg-sky-600 text-white":"border"}`} onClick={()=>setTab("bookings")}>رزروهای من</button></div>{tab==="schedules" && <section className="grid gap-4 md:grid-cols-2"><form onSubmit={createSchedule} className="card p-4 space-y-3"><h2 className="font-bold">ساخت برنامه جدید</h2><input className="input" name="title" placeholder="عنوان برنامه" required/><select className="input" name="dayOfWeek">{weekdayOptions.map(w=><option key={w.v} value={w.v}>{w.l}</option>)}</select><div className="grid grid-cols-2 gap-2"><input className="input" name="startTime" type="time" required/><input className="input" name="endTime" type="time" required/></div><input className="input" name="question" placeholder="سوال اختیاری (مثلاً شماره دانشجویی)"/><button className="btn-primary w-full">ایجاد برنامه</button></form><div className="space-y-3">{schedules.map(s=><div className="card p-4" key={s.id}><h3 className="font-semibold">{s.title}</h3><p className="text-sm text-slate-600 mt-2">لینک اشتراک: <a className="text-sky-600" href={`/schedule/${s.shareId}`}>{`/schedule/${s.shareId}`}</a></p></div>)}</div></section>}{tab==="bookings" && <section className="card p-4"><select className="input max-w-sm mb-4" value={scheduleFilter} onChange={(e)=>setScheduleFilter(e.target.value)}><option value="">همه برنامه‌ها</option>{schedules.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><div className="space-y-3">{bookings.map(b=><div key={b.id} className="rounded-xl border p-3"><div className="font-medium">{b.schedule.title}</div><div className="text-sm text-slate-600">نام رزروکننده: {b.visitorName || "-"}</div><div className="text-sm text-slate-600">زمان: {new Date(b.timeSlot.startTime).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</div><div className="text-sm">پاسخ‌ها: {Array.isArray(b.answers)? b.answers.join(" | ") : "-"}</div></div>)}</div></section>}</main>;
}
