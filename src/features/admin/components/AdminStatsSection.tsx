import { CalendarDays, Clock3, ListChecks, Users } from "lucide-react";
import type { AdminStats } from "@/features/admin/types/admin";

type Props = {
  stats: AdminStats | null;
  overviewLoading: boolean;
};

export function AdminStatsSection({ stats, overviewLoading }: Props) {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card space-y-2 p-4"><div className="flex items-center justify-between text-sm text-slate-400">کاربران<Users size={16} /></div><div className="text-2xl font-bold">{stats?.totalUsers ?? "-"}</div></div>
        <div className="card space-y-2 p-4"><div className="flex items-center justify-between text-sm text-slate-400">برنامه‌ها<CalendarDays size={16} /></div><div className="text-2xl font-bold">{stats?.totalSchedules ?? "-"}</div></div>
        <div className="card space-y-2 p-4"><div className="flex items-center justify-between text-sm text-slate-400">رزروها<ListChecks size={16} /></div><div className="text-2xl font-bold">{stats?.totalBookings ?? "-"}</div></div>
        <div className="card space-y-2 p-4"><div className="flex items-center justify-between text-sm text-slate-400">جلسات آینده<Clock3 size={16} /></div><div className="text-2xl font-bold">{stats?.upcomingSessions ?? "-"}</div></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">آمار رزروها</h2>{overviewLoading && <span className="text-xs text-slate-400">در حال به‌روزرسانی...</span>}</div>
          <div className="grid gap-2 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">رزروهای امروز <span className="font-semibold text-slate-100">{stats?.bookingsToday ?? "-"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">رزروهای ۷ روز اخیر <span className="font-semibold text-slate-100">{stats?.bookingsWeek ?? "-"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">رزروهای ۳۰ روز اخیر <span className="font-semibold text-slate-100">{stats?.bookingsMonth ?? "-"}</span></div>
          </div>
        </div>
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">جلسات انجام‌شده</h2></div>
          <div className="grid gap-2 text-sm text-slate-300">
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">جلسات امروز <span className="font-semibold text-slate-100">{stats?.sessionsToday ?? "-"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">جلسات ۷ روز اخیر <span className="font-semibold text-slate-100">{stats?.sessionsWeek ?? "-"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">جلسات ۳۰ روز اخیر <span className="font-semibold text-slate-100">{stats?.sessionsMonth ?? "-"}</span></div>
          </div>
        </div>
      </section>
    </>
  );
}
