"use client";

import { useMemo } from "react";
import { Moon, Sun, Shield, LogOut } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUIStore } from "@/shared/store/ui-store";
import { ThemeLogo } from "@/shared/ui/theme-logo";
import { AdminSmsSection } from "@/features/admin/components/AdminSmsSection";
import { AdminStatsSection } from "@/features/admin/components/AdminStatsSection";
import { AdminUsersSection } from "@/features/admin/components/AdminUsersSection";
import type { AdminStats, SmsCounts, SmsSettings, UsersResponse } from "@/features/admin/types/admin";
import { useAdminPanelUIStore } from "@/features/admin/store/admin-panel-ui-store";

const adminLoginSchema = z.object({
  username: z.string().min(1, "نام کاربری الزامی است"),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

type AdminLoginInput = z.infer<typeof adminLoginSchema>;

type OverviewResponse = {
  stats: AdminStats | null;
  smsCounts: SmsCounts;
  smsSettings: SmsSettings | null;
};

export default function AdminPanelPage() {
  const queryClient = useQueryClient();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const usersQuery = useAdminPanelUIStore((s) => s.usersQuery);
  const setUsersQuery = useAdminPanelUIStore((s) => s.setUsersQuery);
  const usersPage = useAdminPanelUIStore((s) => s.usersPage);
  const setUsersPage = useAdminPanelUIStore((s) => s.setUsersPage);
  const usersPageSize = useAdminPanelUIStore((s) => s.usersPageSize);
  const avatarPreview = useAdminPanelUIStore((s) => s.avatarPreview);
  const setAvatarPreview = useAdminPanelUIStore((s) => s.setAvatarPreview);

  const loginForm = useForm<AdminLoginInput>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: { username: "", password: "" },
  });

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

  const adminMeQuery = useQuery({
    queryKey: ["admin", "me"],
    queryFn: async () => {
      const res = await fetch("/api/admin/me", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { isAdmin: false, configured: Boolean(data?.configured) };
      }
      return { isAdmin: true, configured: true };
    },
  });

  const isAdmin = adminMeQuery.data?.isAdmin ?? false;
  const configured = adminMeQuery.data?.configured ?? true;

  const overviewQuery = useQuery({
    queryKey: ["admin", "overview"],
    enabled: isAdmin,
    queryFn: async (): Promise<OverviewResponse> => {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "خطا در دریافت اطلاعات");
      return {
        stats: data.stats || null,
        smsCounts: data.smsCounts || {},
        smsSettings: data.smsSettings || null,
      };
    },
  });

  const usersListQuery = useQuery({
    queryKey: ["admin", "users", usersQuery, usersPage, usersPageSize],
    enabled: isAdmin,
    queryFn: async (): Promise<UsersResponse> => {
      const url = new URL("/api/admin/users", window.location.origin);
      if (usersQuery.trim()) url.searchParams.set("q", usersQuery.trim());
      url.searchParams.set("page", String(usersPage));
      url.searchParams.set("pageSize", String(usersPageSize));
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "خطا در دریافت کاربران");
      return data;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (payload: AdminLoginInput) => {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ورود ناموفق بود");
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
      ]);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => fetch("/api/admin/logout", { method: "POST" }),
    onSuccess: async () => {
      await queryClient.setQueryData(["admin", "me"], { isAdmin: false, configured: true });
    },
  });

  const smsMutation = useMutation({
    mutationFn: async (next: SmsSettings) => {
      const res = await fetch("/api/admin/sms-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.details || "خطا در ذخیره تنظیمات پیامک");
      return data as SmsSettings;
    },
    onSuccess: (nextSmsSettings) => {
      queryClient.setQueryData(["admin", "overview"], (prev: OverviewResponse | undefined) =>
        prev ? { ...prev, smsSettings: nextSmsSettings } : prev,
      );
    },
  });

  const smsCountCards = useMemo(() => {
    const smsCounts = overviewQuery.data?.smsCounts || {};
    const entries = [
      { key: "BOOKING_CREATED", label: "رزرو جدید" },
      { key: "BOOKING_CANCELED", label: "لغو رزرو" },
      { key: "BOOKING_REMINDER", label: "یادآوری جلسه" },
      { key: "OTP", label: "کد تایید" },
    ];
    return entries.map((entry) => ({ ...entry, value: smsCounts[entry.key] || 0 }));
  }, [overviewQuery.data?.smsCounts]);

  const users = usersListQuery.data ?? null;
  const usersTotalPages = Math.max(1, Math.ceil((users?.total || 0) / (users?.pageSize || usersPageSize)));
  const overviewError = (overviewQuery.error as Error | null)?.message || (smsMutation.error as Error | null)?.message || "";

  const handleLogin = loginForm.handleSubmit(async (values) => {
    await loginMutation.mutateAsync(values);
  });

  if (adminMeQuery.isPending) {
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
              <input className="input" autoComplete="username" {...loginForm.register("username")} />
              {loginForm.formState.errors.username && <p className="mt-1 text-xs text-rose-300">{loginForm.formState.errors.username.message}</p>}
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">رمز عبور</label>
              <input className="input" type="password" autoComplete="current-password" {...loginForm.register("password")} />
              {loginForm.formState.errors.password && <p className="mt-1 text-xs text-rose-300">{loginForm.formState.errors.password.message}</p>}
            </div>
            {loginMutation.isError && <div className="text-sm text-rose-300">{(loginMutation.error as Error).message}</div>}
            <button className="btn-primary w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "در حال ورود..." : "ورود"}
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
          <button type="button" className="btn-danger" onClick={() => logoutMutation.mutate()}><LogOut size={16} className="icon-danger" /> خروج</button>
        </div>
      </div>

      {overviewError && <div className="card p-4 text-sm text-rose-300">{overviewError}</div>}

      <AdminStatsSection stats={overviewQuery.data?.stats || null} overviewLoading={overviewQuery.isFetching} />
      <AdminSmsSection
        smsCountCards={smsCountCards}
        smsSaving={smsMutation.isPending}
        smsSettings={overviewQuery.data?.smsSettings || null}
        updateSmsSetting={async (next) => {
          await smsMutation.mutateAsync(next);
        }}
      />
      <AdminUsersSection
        users={users}
        usersQuery={usersQuery}
        setUsersQuery={setUsersQuery}
        setUsersPage={setUsersPage}
        usersPage={usersPage}
        usersTotalPages={usersTotalPages}
        usersLoading={usersListQuery.isFetching}
        usersError={(usersListQuery.error as Error | null)?.message || ""}
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
