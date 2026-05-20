"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Moon, Sun, Shield, LogOut } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useUIStore } from "@/shared/store/ui-store";
import { ThemeLogo } from "@/shared/ui/theme-logo";
import { AdminSmsSection } from "@/features/admin/components/AdminSmsSection";
import { AdminStatsSection } from "@/features/admin/components/AdminStatsSection";
import { AdminUsersSection } from "@/features/admin/components/AdminUsersSection";
import type { AdminStats, SmsCounts, SmsSettings, UsersResponse } from "@/features/admin/types/admin";

export default function AdminPanelPage() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const [isAdmin, setIsAdmin] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [checking, setChecking] = useState(true);

  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [smsCounts, setSmsCounts] = useState<SmsCounts>({});
  const [smsSettings, setSmsSettings] = useState<SmsSettings | null>(null);
  const [smsSaving, setSmsSaving] = useState(false);

  const [users, setUsers] = useState<UsersResponse | null>(null);
  const [usersQuery, setUsersQuery] = useState("");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(20);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<{ url: string; name: string } | null>(null);

  function normalizePreviewUrl(src?: string | null) {
    if (!src) return theme === "light" ? "/default-avatar-light.svg" : "/default-avatar-dark.svg";
    if (src.startsWith("/")) return src;
    try {
      const url = new URL(src);
      if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/profile/avatar")) {
        return `${url.pathname}${url.search}`;
      }
    } catch {}
    return src;
  }

  useEffect(() => {
    let active = true;
    async function check() {
      setChecking(true);
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      if (!active) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setConfigured(Boolean(data?.configured));
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
      setChecking(false);
    }
    check();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError("");
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (!active) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOverviewError(data?.error || "خطا در دریافت اطلاعات");
        setOverviewLoading(false);
        return;
      }
      const data = await res.json();
      setStats(data.stats || null);
      setSmsCounts(data.smsCounts || {});
      setSmsSettings(data.smsSettings || null);
      setOverviewLoading(false);
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;

    async function loadUsers() {
      const url = new URL("/api/admin/users", window.location.origin);
      if (usersQuery.trim()) url.searchParams.set("q", usersQuery.trim());
      url.searchParams.set("page", String(usersPage));
      url.searchParams.set("pageSize", String(usersPageSize));

      setUsersLoading(true);
      setUsersError("");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!active) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUsersError(data?.error || "خطا در دریافت کاربران");
        setUsersLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data);
      setUsersLoading(false);
    }

    loadUsers();
    return () => {
      active = false;
    };
  }, [isAdmin, usersQuery, usersPage, usersPageSize]);

  const smsCountCards = useMemo(() => {
    const entries = [
      { key: "BOOKING_CREATED", label: "رزرو جدید" },
      { key: "BOOKING_CANCELED", label: "لغو رزرو" },
      { key: "BOOKING_REMINDER", label: "یادآوری جلسه" },
      { key: "OTP", label: "کد تایید" },
    ];
    return entries.map((entry) => ({ ...entry, value: smsCounts[entry.key] || 0 }));
  }, [smsCounts]);

  const usersTotalPages = Math.max(1, Math.ceil((users?.total || 0) / (users?.pageSize || usersPageSize)));

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoginLoading(false);
    if (!res.ok) {
      setLoginError(data?.error || "ورود ناموفق بود");
      return;
    }
    setIsAdmin(true);
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAdmin(false);
  }

  async function updateSmsSetting(next: SmsSettings) {
    if (!smsSettings) return;
    setSmsSaving(true);
    const previous = smsSettings;
    setSmsSettings(next);
    const res = await fetch("/api/admin/sms-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSmsSaving(false);
    if (!res.ok) {
      setSmsSettings(previous);
      setOverviewError(data?.error || data?.details || "خطا در ذخیره تنظیمات پیامک");
      return;
    }
    setSmsSettings(data);
  }

  if (checking) {
    return (
      <main className="page-shell py-8">
        <div className="card p-6 text-center text-sm text-slate-400">در حال بررسی دسترسی...</div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="page-shell py-8">
        <div className="card p-6 text-center text-sm text-rose-300">تنظیمات ادمین در فایل env تعریف نشده است.</div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="page-shell py-10">
        <div className="mx-auto grid max-w-md gap-6">
          <div className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <ThemeLogo size={44} />
              <div>
                <div className="text-base font-bold">پنل ادمین</div>
                <div className="text-xs text-slate-400">ورود مدیر سامانه</div>
              </div>
            </div>
            <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={toggleTheme} aria-label="تغییر تم">
              {theme === "dark" ? <Sun strokeWidth={2.25} /> : <Moon strokeWidth={2.25} />}
            </button>
          </div>

          <form onSubmit={handleLogin} className="card space-y-4 p-5">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Shield size={18} /> ورود امن
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">نام کاربری</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">رمز عبور</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {loginError && <div className="text-sm text-rose-300">{loginError}</div>}
            <button className="btn-primary w-full" disabled={loginLoading}>
              {loginLoading ? "در حال ورود..." : "ورود"}
            </button>
            <Link href="/" className="btn-ghost w-full justify-center">رفتن به سایت</Link>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-6 py-6">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-3">
          <ThemeLogo size={48} />
          <div>
            <h1 className="text-xl font-bold">پنل ادمین</h1>
            <p className="text-sm text-slate-400">کنترل کامل وضعیت سامانه</p>
          </div>
        </div>
        <div className="ms-auto flex items-center gap-2">
          <button type="button" className="btn-ghost theme-toggle header-action-btn w-10 p-0" onClick={toggleTheme} aria-label="تغییر تم">
            {theme === "dark" ? <Sun strokeWidth={2.25} /> : <Moon strokeWidth={2.25} />}
          </button>
          <Link href="/" className="btn-ghost">رفتن به سایت</Link>
          <button type="button" className="btn-danger" onClick={handleLogout}><LogOut size={16} className="icon-danger" /> خروج</button>
        </div>
      </div>

      {overviewError && <div className="card p-4 text-sm text-rose-300">{overviewError}</div>}

      <AdminStatsSection stats={stats} overviewLoading={overviewLoading} />
      <AdminSmsSection smsCountCards={smsCountCards} smsSaving={smsSaving} smsSettings={smsSettings} updateSmsSetting={updateSmsSetting} />
      <AdminUsersSection
        users={users}
        usersQuery={usersQuery}
        setUsersQuery={setUsersQuery}
        setUsersPage={setUsersPage}
        usersPage={usersPage}
        usersTotalPages={usersTotalPages}
        usersLoading={usersLoading}
        usersError={usersError}
        onAvatarClick={(avatarUrl, displayName) => setAvatarPreview({ url: normalizePreviewUrl(avatarUrl), name: displayName })}
      />

      {avatarPreview && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/80 p-4" onClick={() => setAvatarPreview(null)}>
          <div className="card w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">{avatarPreview.name}</h3>
            <Image src={avatarPreview.url} alt={avatarPreview.name} width={1200} height={900} className="mx-auto max-h-[70vh] w-auto rounded-2xl object-contain" unoptimized />
            <div className="mt-4 flex justify-end"><button type="button" className="btn-ghost" onClick={() => setAvatarPreview(null)}>بستن</button></div>
          </div>
        </div>
      )}
    </main>
  );
}

