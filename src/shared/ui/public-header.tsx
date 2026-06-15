"use client";

import Link from "next/link";
import { LogIn, MoonStar, Sun, User } from "lucide-react";
import { useUIStore } from "@/shared/store/ui-store";

type PublicHeaderProps = {
  compact?: boolean;
};

export function PublicHeader({ compact: _compact = false }: PublicHeaderProps) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className="card mb-8 min-h-[76px] overflow-hidden p-4 md:mb-10">
      <div className="flex flex-nowrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-500/15 text-slate-400 sm:h-11 sm:w-11">
            <User size={18} />
          </div>
          <div className="min-w-0 overflow-hidden">
            <h2 className="truncate text-base font-bold sm:text-lg">داشبورد رزرو</h2>
            <p className="hidden truncate text-xs text-slate-400 sm:block">مدیریت زمان‌بندی و نوبت‌ها</p>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 flex-nowrap items-center gap-3 sm:ml-3 sm:gap-4">
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

