"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import { CalendarDays, Clock3, Send } from "lucide-react";
import Link from "next/link";

function toEnglishDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function toGregorianYmd(dateObj: any) {
  if (!dateObj) return "";
  return toEnglishDigits(new DateObject(dateObj).convert(gregorian).format("YYYY-MM-DD"));
}

export default function PublicSchedulePage({ params }: { params: { shareId: string } }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [pending, startTransition] = useTransition();
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const loadSchedule = useCallback(async () => {
    const res = await fetch(`/api/schedules/${params.shareId}`, { cache: "no-store" });
    const data = await res.json();
    setSchedule(data);
    return data;
  }, [params.shareId]);

  const loadSlots = useCallback(async (date: string) => {
    if (!date) {
      setSlots([]);
      return [];
    }
    const res = await fetch(`/api/schedules/${params.shareId}/slots?date=${date}`, { cache: "no-store" });
    const data = await res.json();
    setSlots(Array.isArray(data) ? data : []);
    return data;
  }, [params.shareId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  useEffect(() => {
    if (!selectedDate) return;
    void loadSlots(selectedDate);
  }, [selectedDate, loadSlots]);

  const questions = useMemo(() => (Array.isArray(schedule?.questions) ? schedule.questions : []), [schedule]);
  const availableDates = useMemo(() => new Set(Array.isArray(schedule?.availableDates) ? schedule.availableDates : []), [schedule]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(() => {
      void (async () => {
        const answers = questions.map((_: any, i: number) => String(formData.get(`q-${i}`) || ""));
        const res = await fetch(`/api/schedules/${params.shareId}/book`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timeSlotId: selectedSlot, name: formData.get("name"), answers }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || "خطا در رزرو");
        toast.success("رزرو با موفقیت ثبت شد");
        setSelectedSlot("");
        await loadSchedule();
        await loadSlots(selectedDate);
      })();
    });
  }

  return (
    <main className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="card space-y-5 p-4 md:p-6">
        <div className="flex justify-end">
          <Link href="/dashboard" className="btn-ghost">رفتن به داشبورد</Link>
        </div>
        <div className="flex items-center gap-3">
          {schedule?.user?.avatarUrl ? (
            <img src={schedule.user.avatarUrl} alt="host avatar" className="h-12 w-12 cursor-pointer rounded-full object-cover border border-slate-700" onClick={() => setAvatarPreviewOpen(true)} />
          ) : (
            <div className="h-12 w-12 rounded-full border border-slate-700" />
          )}
          <div className="text-sm text-slate-400">{schedule?.user?.username || schedule?.user?.phone || "ارائه‌دهنده"}</div>
        </div>
        <h1 className="text-2xl font-bold md:text-3xl">{schedule?.title || "..."}</h1>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300"><CalendarDays size={16} /> انتخاب روز</label>
          <DatePicker
            calendar={persian}
            locale={persian_fa}
            calendarPosition="bottom-right"
            onChange={(d: any) => {
              if (!d) return setSelectedDate("");
              const ymd = toGregorianYmd(d);
              setSelectedDate(ymd);
              setSelectedSlot("");
            }}
            mapDays={({ date }: any) => {
              const ymd = toGregorianYmd(date);
              if (!availableDates.has(ymd)) {
                return { disabled: true, style: { color: "rgb(148, 137, 121)", opacity: 0.45 } };
              }
              return {};
            }}
            render={(value, openCalendar) => (
              <button type="button" onClick={openCalendar} className="btn-ghost w-full justify-between">
                <span className="flex items-center gap-2"><CalendarDays size={16} /> {selectedDate ? "تاریخ انتخاب شد" : "انتخاب تاریخ"}</span>
                <span className="text-xs text-slate-400">{value || ""}</span>
              </button>
            )}
          />
          <p className="mt-2 text-xs text-slate-500">فقط روزهایی فعال هستند که واقعاً بازه آزاد دارند.</p>
        </div>

        {selectedDate && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-300"><Clock3 size={16} /> بازه‌های آزاد</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {slots.length === 0 && <div className="col-span-full rounded-xl border border-slate-800 p-3 text-sm text-slate-400">برای این روز، بازه آزادی باقی نمانده است.</div>}
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSlot(s.id)}
                  className={`btn border border-slate-700 ${selectedSlot === s.id ? "bg-cyan-500 text-slate-950" : "hover:bg-slate-800"}`}
                >
                  {new Date(s.startTime).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Tehran",
                  })}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSlot && (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-800 p-3">
            <input className="input" name="name" placeholder="نام شما (اختیاری)" />
            {questions.map((q: any, i: number) =>
              q.type === "textarea" ? (
                <textarea key={i} className="input min-h-24" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ) : (
                <input key={i} className="input" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ),
            )}
            <button className="btn-primary w-full" disabled={pending}>
              <Send size={16} /> {pending ? "در حال ثبت..." : "ثبت رزرو"}
            </button>
          </form>
        )}
      </div>
      {avatarPreviewOpen && schedule?.user?.avatarUrl && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" onClick={() => setAvatarPreviewOpen(false)}>
          <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">{schedule?.user?.username || schedule?.user?.phone || "ارائه‌دهنده"}</h3>
            <img src={schedule.user.avatarUrl} alt="host avatar preview" className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain" />
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setAvatarPreviewOpen(false)}>بستن</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
