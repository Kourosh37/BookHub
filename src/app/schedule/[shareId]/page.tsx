"use client";

import { useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Clock3, Send } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { PublicHeader } from "@/shared/ui/public-header";
import { useUIStore } from "@/shared/store/ui-store";
import { usePublicScheduleUIStore } from "@/features/schedule/store/public-schedule-ui-store";

const bookingFormSchema = z.object({
  answers: z.array(z.string()),
});

function formatDateButtonLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
}

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function PublicSchedulePage({ params }: { params: { shareId: string } }) {
  const queryClient = useQueryClient();
  const theme = useUIStore((s) => s.theme);
  const selectedDate = usePublicScheduleUIStore((s) => s.selectedDate);
  const setSelectedDate = usePublicScheduleUIStore((s) => s.setSelectedDate);
  const selectedSlot = usePublicScheduleUIStore((s) => s.selectedSlot);
  const setSelectedSlot = usePublicScheduleUIStore((s) => s.setSelectedSlot);
  const avatarPreviewOpen = usePublicScheduleUIStore((s) => s.avatarPreviewOpen);
  const setAvatarPreviewOpen = usePublicScheduleUIStore((s) => s.setAvatarPreviewOpen);
  const bookingError = usePublicScheduleUIStore((s) => s.bookingError);
  const setBookingError = usePublicScheduleUIStore((s) => s.setBookingError);

  const authQuery = useQuery({
    queryKey: ["auth", "me", "schedule-gate"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) throw new Error("UNAUTHORIZED");
      return res.json();
    },
    retry: false,
  });

  useEffect(() => {
    if (authQuery.isError) {
      const next = `/schedule/${params.shareId}`;
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [authQuery.isError, params.shareId]);

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
    mutationFn: async (payload: { timeSlotId: string; answers: string[] }) => {
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
  const dateOptions = useMemo(
    () => (Array.isArray(schedule?.dateOptions) ? [...schedule.dateOptions].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))) : []),
    [schedule],
  );

  const bookingForm = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { answers: [] },
  });

  useEffect(() => {
    bookingForm.reset({ answers: questions.map(() => "") });
  }, [bookingForm, questions]);

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

  const submitBooking = bookingForm.handleSubmit((values) => {
    setBookingError("");
    bookingMutation.mutate(
      { timeSlotId: selectedSlot, answers: values.answers },
      {
        onSuccess: async () => {
          toast.success("رزرو با موفقیت ثبت شد");
          setSelectedSlot("");
          setBookingError("");
          bookingForm.reset({ answers: questions.map(() => "") });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["schedule", "public", params.shareId] }),
            queryClient.invalidateQueries({
              queryKey: ["schedule", "public", params.shareId, "slots", selectedDate],
            }),
          ]);
        },
        onError: (err: any) => {
          const message = err?.message || "خطا در رزرو";
          setBookingError(message);
          toast.error(message);
        },
      },
    );
  });

  if (authQuery.isPending || authQuery.isError) {
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {dateOptions.length === 0 && (
              <div className="col-span-full rounded-xl surface-block p-3 text-sm text-slate-400">تاریخی برای نمایش باقی نمانده است.</div>
            )}
            {dateOptions.map((option: any) => {
              const date = String(option.date);
              const active = selectedDate === date;
              const isFull = Boolean(option.isFull);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedSlot("");
                  }}
                  className={`btn min-h-12 flex-col justify-center gap-1 text-sm ${active ? "bg-cyan-500 text-slate-950" : isFull ? "btn-ghost opacity-75" : "btn-ghost"}`}
                >
                  <span>{formatDateButtonLabel(date)}</span>
                  {isFull && <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-slate-950/15 text-slate-950" : "bg-rose-500/15 text-rose-300"}`}>پر شده</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">روزهای پرشده هم نمایش داده می‌شوند، اما امکان رزرو ندارند.</p>
        </div>

        {selectedDate && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-300"><Clock3 size={16} /> بازه‌ها</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {slots.length === 0 && <div className="col-span-full rounded-xl surface-block p-3 text-sm text-slate-400">برای این روز، بازه‌ای برای نمایش باقی نمانده است.</div>}
              {slots.map((s) => {
                const isBooked = Boolean(s.isBooked);
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isBooked}
                    onClick={() => {
                      if (!isBooked) setSelectedSlot(s.id);
                    }}
                    className={`btn flex-col gap-1 ${selectedSlot === s.id ? "bg-cyan-500 text-slate-950" : isBooked ? "btn-ghost cursor-not-allowed opacity-60" : "btn-ghost"}`}
                  >
                    <span>
                      {new Date(s.startTime).toLocaleTimeString("fa-IR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Asia/Tehran",
                      })}
                    </span>
                    {isBooked && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-300">رزرو شده</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selectedSlot && (
          <form onSubmit={submitBooking} className="space-y-3 rounded-xl surface-block p-3">
            {questions.map((q: any, i: number) =>
              q.type === "textarea" ? (
                <textarea key={i} className="input min-h-24" placeholder={q.label} required={q.required} {...bookingForm.register(`answers.${i}`)} />
              ) : (
                <input key={i} className="input" placeholder={q.label} required={q.required} {...bookingForm.register(`answers.${i}`)} />
              ),
            )}
            <button className="btn-primary w-full" disabled={bookingMutation.isPending}>
              <Send size={16} /> {bookingMutation.isPending ? "در حال ثبت..." : "ثبت رزرو"}
            </button>
            {bookingError && <p className="text-sm text-rose-300">{bookingError}</p>}
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
