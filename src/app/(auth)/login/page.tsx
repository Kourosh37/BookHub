"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

function resolveNextPath(raw: string) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  if (raw === "/register" || raw.startsWith("/register?")) return "/dashboard";
  return raw;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);
  const nextPath = useMemo(() => resolveNextPath(nextParam), [nextParam]);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then((r) => {
      if (r.ok) window.location.replace(nextPath);
    });
  }, [nextPath]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return toast.error(data.details || data.error || "ورود ناموفق بود");
    toast.success("خوش آمدید");
    window.location.replace(nextPath);
  }

  const registerHref = nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register";

  return <main className="mx-auto max-w-md p-6"><form onSubmit={onSubmit} autoComplete="off" className="card space-y-4 p-6"><h1 className="text-xl font-bold">ورود</h1><input className="input" name="username" autoComplete="off" placeholder="نام کاربری" required/><input className="input" name="password" type="password" autoComplete="new-password" placeholder="رمز عبور" required/><button className="btn-primary w-full" disabled={loading}>{loading?"در حال ورود...":"ورود"}</button><p className="text-sm">حساب ندارید؟ <Link className="text-sky-600" href={registerHref}>ثبت‌نام</Link></p></form></main>;
}
