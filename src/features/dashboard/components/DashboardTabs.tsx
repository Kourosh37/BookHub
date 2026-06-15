type Tab = "schedules" | "bookings" | "sessions" | "profile" | "settings";

type Props = {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
};

import { CalendarDays, Clock3, ListChecks, Settings, UserCircle2 } from "lucide-react";

export function DashboardDesktopTabs({ tab, onTabChange }: Props) {
  return (
    <div className="hidden flex-wrap gap-2 md:mb-4 md:flex">
      <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("schedules")}>
        <CalendarDays size={16} /> برنامه‌های من
      </button>
      <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("bookings")}>
        <ListChecks size={16} /> رزروهای من
      </button>
      <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("sessions")}>
        <Clock3 size={16} /> جلسات من
      </button>
      <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("profile")}>
        <UserCircle2 size={16} /> پروفایل
      </button>
      <button className={`btn ${tab === "settings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("settings")}>
        <Settings size={16} /> تنظیمات
      </button>
    </div>
  );
}

export function DashboardMobileTabs({ tab, onTabChange }: Props) {
  const tabOrder: Tab[] = ["schedules", "bookings", "sessions", "profile", "settings"];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 md:hidden">
      <div className="relative card mx-auto grid max-w-md grid-cols-5 gap-2 overflow-hidden p-2">
        <div
          className="absolute bottom-0 right-0 h-1 rounded-t-full bg-cyan-500 transition-all duration-300 ease-out"
          style={{
            width: `${100 / tabOrder.length}%`,
            transform: `translateX(${-tabOrder.indexOf(tab) * 100}%)`,
          }}
        />

        <button className={`btn ${tab === "schedules" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("schedules")}>
          <CalendarDays size={15} />
        </button>
        <button className={`btn ${tab === "bookings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("bookings")}>
          <ListChecks size={15} />
        </button>
        <button className={`btn ${tab === "sessions" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("sessions")}>
          <Clock3 size={15} />
        </button>
        <button className={`btn ${tab === "profile" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("profile")}>
          <UserCircle2 size={15} />
        </button>
        <button className={`btn ${tab === "settings" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => onTabChange("settings")}>
          <Settings size={15} />
        </button>
      </div>
    </nav>
  );
}
