"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

function toGregorianYmd(dateObj: any) {
  const g = dateObj.toDate();
  const yyyy = g.getFullYear();
  const mm = String(g.getMonth() + 1).padStart(2, "0");
  const dd = String(g.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function PublicSchedulePage({ params }: { params: { shareId: string } }) {
  const [schedule, setSchedule] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch(`/api/schedules/${params.shareId}`).then((r) => r.json()).then(setSchedule);
  }, [params.shareId]);

  useEffect(() => {
    if (!selectedDate) return;
    fetch(`/api/schedules/${params.shareId}/slots?date=${selectedDate}`).then((r) => r.json()).then(setSlots);
  }, [selectedDate, params.shareId]);

  const questions = useMemo(() => (Array.isArray(schedule?.questions) ? schedule.questions : []), [schedule]);
  const availableDates = useMemo(() => {
    const rows = Array.isArray(schedule?.daysConfig) ? schedule.daysConfig : [];
    return new Set(rows.map((d: any) => d.date));
  }, [schedule]);

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
      })();
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="card space-y-5 p-6">
        <h1 className="text-2xl font-bold">{schedule?.title || "..."}</h1>
        <div>
          <label className="mb-2 block">تاریخ را انتخاب کنید</label>
          <DatePicker
            calendar={persian}
            locale={persian_fa}
            calendarPosition="bottom-right"
            onChange={(d: any) => {
              if (!d) return setSelectedDate("");
              setSelectedDate(toGregorianYmd(d));
              setSelectedSlot("");
            }}
            mapDays={({ date }: any) => {
              const ymd = toGregorianYmd(date);
              if (!availableDates.has(ymd)) return { disabled: true, style: { color: "#94a3b8" } };
              return {};
            }}
            inputClass="input"
          />
        </div>

        {selectedDate && (
          <div>
            <p className="mb-2">بازه‌های آزاد</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSlot(s.id)}
                  className={`btn border ${selectedSlot === s.id ? "bg-sky-600 text-white" : ""}`}
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
          <form onSubmit={handleSubmit} className="space-y-3">
            <input className="input" name="name" placeholder="نام شما (اختیاری)" />
            {questions.map((q: any, i: number) =>
              q.type === "textarea" ? (
                <textarea key={i} className="input min-h-24" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ) : (
                <input key={i} className="input" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ),
            )}
            <button className="btn-primary" disabled={pending}>
              {pending ? "در حال ثبت..." : "ثبت رزرو"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
