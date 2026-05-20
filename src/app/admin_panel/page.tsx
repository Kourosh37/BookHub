"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Moon, Sun, Shield, LogOut, Users, CalendarDays, ListChecks, Clock3, Phone, Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useUIStore } from "@/store/ui-store";
import { ThemeLogo } from "@/components/theme-logo";
import { UserAvatar } from "@/components/user-avatar";

type AdminStats = {
  totalUsers: number;
  totalSchedules: number;
  totalBookings: number;
  bookingsToday: number;
  bookingsWeek: number;
  bookingsMonth: number;
  sessionsToday: number;
  sessionsWeek: number;
  sessionsMonth: number;
  upcomingSessions: number;
};

type SmsCounts = Record<string, number>;

type SmsSettings = {
  bookingCreatedEnabled: boolean;
  bookingCanceledEnabled: boolean;
  bookingReminderEnabled: boolean;
};

type AdminUser = {
  id: string;
  phone: string | null;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type UsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4 p-4">
          <h2 className="text-base font-semibold">آمار پیامک‌ها</h2>
          <div className="grid gap-2 text-sm text-slate-300">
            {smsCountCards.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">{entry.label}<span className="font-semibold text-slate-100">{entry.value}</span></div>
            ))}
          </div>
        </div>
        <div className="card space-y-4 p-4">
          <div className="flex items-center justify-between"><h2 className="text-base font-semibold">کنترل پیامک‌ها</h2>{smsSaving && <span className="text-xs text-slate-400">در حال ذخیره...</span>}</div>
          {smsSettings ? (
            <div className="grid gap-2 text-sm text-slate-300">
              <label className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">رزرو جدید<input type="checkbox" checked={smsSettings.bookingCreatedEnabled} onChange={(e) => updateSmsSetting({ ...smsSettings, bookingCreatedEnabled: e.target.checked })} disabled={smsSaving} /></label>
              <label className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">لغو رزرو<input type="checkbox" checked={smsSettings.bookingCanceledEnabled} onChange={(e) => updateSmsSetting({ ...smsSettings, bookingCanceledEnabled: e.target.checked })} disabled={smsSaving} /></label>
              <label className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">یادآوری جلسه<input type="checkbox" checked={smsSettings.bookingReminderEnabled} onChange={(e) => updateSmsSetting({ ...smsSettings, bookingReminderEnabled: e.target.checked })} disabled={smsSaving} /></label>
              <div className="text-xs text-slate-400">با خاموش کردن هر گزینه، پیامک مربوطه برای همه کاربران ارسال نمی‌شود.</div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">تنظیمات پیامک در دسترس نیست.</div>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-base font-semibold">لیست کاربران</div>
          <div className="ms-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm text-slate-300">
            <Search size={16} />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="جستجو با شماره موبایل یا نام کاربری"
              value={usersQuery}
              onChange={(e) => {
                setUsersQuery(e.target.value);
                setUsersPage(1);
              }}
            />
          </div>
        </div>

        <div className="space-y-3">
          {usersError && <div className="text-sm text-rose-300">{usersError}</div>}
          {usersLoading && <div className="text-sm text-slate-400">در حال دریافت کاربران...</div>}

          {users?.items?.length ? (
            users.items.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2">
                <UserAvatar
                  src={user.avatarUrl}
                  alt="avatar"
                  sizeClassName="h-9 w-9"
                  iconSize={16}
                  onClick={() => setAvatarPreview({ url: normalizePreviewUrl(user.avatarUrl), name: user.username || user.phone || "کاربر" })}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm break-words">{user.username || "کاربر"}</div>
                  <div className="text-xs text-slate-400">عضویت: {new Date(user.createdAt).toLocaleDateString("fa-IR")}</div>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Phone size={14} />
                  <span dir="ltr">{user.phone || "-"}</span>
                </div>
              </div>
            ))
          ) : (
            !usersLoading && <div className="text-sm text-slate-400">کاربری پیدا نشد.</div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700/50 pt-3 text-sm">
          <span className="text-slate-400">صفحه {users?.page || usersPage} از {usersTotalPages} · مجموع {users?.total ?? 0} کاربر</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-ghost" disabled={(users?.page || usersPage) <= 1 || usersLoading} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>قبلی</button>
            <button type="button" className="btn-ghost" disabled={(users?.page || usersPage) >= usersTotalPages || usersLoading} onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}>بعدی</button>
          </div>
        </div>
      </section>

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
