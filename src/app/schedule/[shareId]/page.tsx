"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DatePicker from "react-multi-date-picker";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import { CalendarDays, Clock3, Send } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import Image from "next/image";
import { PublicHeader } from "@/components/public-header";
import { useUIStore } from "@/store/ui-store";

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
  const queryClient = useQueryClient();
  const theme = useUIStore((s) => s.theme);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          const next = `/schedule/${params.shareId}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (active) setAuthChecked(true);
      } catch {
        const next = `/schedule/${params.shareId}`;
        window.location.replace(`/login?next=${encodeURIComponent(next)}`);
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, [params.shareId]);

  const scheduleQuery = useQuery({
    queryKey: ["schedule", "public", params.shareId],
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${params.shareId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_SCHEDULE");
      return res.json();
    },
  });

  const slotsQuery = useQuery({
    queryKey: ["schedule", "public", params.shareId, "slots", selectedDate],
    enabled: Boolean(selectedDate),
    queryFn: async () => {
      const res = await fetch(`/api/schedules/${params.shareId}/slots?date=${selectedDate}`, { cache: "no-store" });
      if (!res.ok) throw new Error("FAILED_SLOTS");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async (payload: { timeSlotId: string; name: FormDataEntryValue | null; answers: string[] }) => {
      const res = await fetch(`/api/schedules/${params.shareId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در رزرو");
      return data;
    },
  });

  const schedule = scheduleQuery.data ?? null;
  const slots = slotsQuery.data ?? [];

  const questions = useMemo(() => (Array.isArray(schedule?.questions) ? schedule.questions : []), [schedule]);
  const availableDates = useMemo(() => new Set(Array.isArray(schedule?.availableDates) ? schedule.availableDates : []), [schedule]);
  const previewAvatarUrl = useMemo(() => {
    const src = schedule?.user?.avatarUrl;
    if (!src) return theme === "light" ? "/default-avatar-light.svg" : "/default-avatar-dark.svg";
    if (src.startsWith("/")) return src;
    try {
      const url = new URL(src);
      if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/profile/avatar")) {
        return `${url.pathname}${url.search}`;
      }
    } catch {}
    return src;
  }, [schedule?.user?.avatarUrl, theme]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const answers = questions.map((_: any, i: number) => String(formData.get(`q-${i}`) || ""));

    bookingMutation.mutate(
      { timeSlotId: selectedSlot, name: formData.get("name"), answers },
      {
        onSuccess: async () => {
          toast.success("رزرو با موفقیت ثبت شد");
          setSelectedSlot("");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["schedule", "public", params.shareId] }),
            queryClient.invalidateQueries({
              queryKey: ["schedule", "public", params.shareId, "slots", selectedDate],
            }),
          ]);
        },
        onError: (err: any) => toast.error(err?.message || "خطا در رزرو"),
      },
    );
  }

  if (!authChecked) {
    return (
      <main className="page-shell py-4 md:py-6">
        <PublicHeader compact />
      </main>
    );
  }

  return (
    <main className="page-shell py-4 md:py-6">
      <PublicHeader compact />
      <div className="card space-y-5 p-4 md:p-6">
        <div className="flex justify-start">
          <Link href="/dashboard" className="btn-ghost">رفتن به داشبورد</Link>
        </div>
        <div className="flex items-center gap-3">
          <UserAvatar src={schedule?.user?.avatarUrl} alt="host avatar" sizeClassName="h-12 w-12" iconSize={18} onClick={() => setAvatarPreviewOpen(true)} />
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
              {slots.length === 0 && <div className="col-span-full rounded-xl surface-block p-3 text-sm text-slate-400">برای این روز، بازه آزادی باقی نمانده است.</div>}
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSlot(s.id)}
                  className={`btn ${selectedSlot === s.id ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`}
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
          <form onSubmit={handleSubmit} className="space-y-3 rounded-xl surface-block p-3">
            <input className="input" name="name" placeholder="نام شما (اختیاری)" />
            {questions.map((q: any, i: number) =>
              q.type === "textarea" ? (
                <textarea key={i} className="input min-h-24" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ) : (
                <input key={i} className="input" name={`q-${i}`} placeholder={q.label} required={q.required} />
              ),
            )}
            <button className="btn-primary w-full" disabled={bookingMutation.isPending}>
              <Send size={16} /> {bookingMutation.isPending ? "در حال ثبت..." : "ثبت رزرو"}
            </button>
          </form>
        )}
      </div>
      {avatarPreviewOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" onClick={() => setAvatarPreviewOpen(false)}>
          <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">{schedule?.user?.username || schedule?.user?.phone || "ارائه‌دهنده"}</h3>
            <Image
              src={previewAvatarUrl}
              alt="host avatar preview"
              width={1200}
              height={900}
              className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain"
              unoptimized
            />
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-ghost" onClick={() => setAvatarPreviewOpen(false)}>بستن</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
