"use client";

import Link from "next/link";
import { LogIn, MoonStar, Sun, User } from "lucide-react";
import { useUIStore } from "@/store/ui-store";

type PublicHeaderProps = {
  compact?: boolean;
  mobileLayout?: boolean;
};

export function PublicHeader({ compact = false, mobileLayout = false }: PublicHeaderProps) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  return (
    <header className={`card mb-5 ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-700 text-slate-400">
            <User size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">داشبورد رزرو</h2>
            <p className="hidden truncate text-xs text-slate-400 sm:block">مدیریت زمان‌بندی و نوبت‌ها</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link href="/login" className="btn-ghost h-10 px-3 text-sm" aria-label="ورود" title="ورود">
            <LogIn size={18} />
            <span className="hidden sm:inline">ورود</span>
          </Link>
          <button type="button" className="btn-ghost theme-toggle h-10 w-10 p-0" onClick={toggleTheme} aria-label="تغییر تم">
            {theme === "dark" ? <Sun /> : <MoonStar />}
          </button>
        </div>
      </div>
    </header>
  );
}
