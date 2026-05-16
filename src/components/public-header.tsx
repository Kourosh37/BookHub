"use client";

import Link from "next/link";
import { LogIn, MoonStar, Sun, User } from "lucide-react";
import { useUIStore } from "@/store/ui-store";

type PublicHeaderProps = {
  compact?: boolean;
};

export function PublicHeader({ compact = false }: PublicHeaderProps) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className={`card mb-5 overflow-hidden ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
      <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 overflow-hidden">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-500/15 text-slate-400 sm:h-10 sm:w-10">
            <User size={18} />
          </div>
          <div className="min-w-0 overflow-hidden">
            <h2 className="truncate text-sm font-bold sm:text-base">داشبورد رزرو</h2>
            <p className="hidden truncate text-xs text-slate-400 sm:block">مدیریت زمان‌بندی و نوبت‌ها</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
          <Link href="/login" className="btn-ghost h-10 px-3 text-sm" aria-label="ورود" title="ورود">
            <LogIn size={18} />
            <span className="hidden sm:inline">ورود</span>
          </Link>
          <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={toggleTheme} aria-label="تغییر تم">
            {theme === "dark" ? <Sun /> : <MoonStar />}
          </button>
        </div>
      </div>
    </header>
  );
}
