"use client";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

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
    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/dashboard");
  }

  const next = searchParams.get("next");
  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return <main className="mx-auto max-w-md p-6"><form onSubmit={onSubmit} autoComplete="off" className="card space-y-4 p-6"><h1 className="text-xl font-bold">ورود</h1><input className="input" name="username" autoComplete="off" placeholder="نام کاربری" required/><input className="input" name="password" type="password" autoComplete="new-password" placeholder="رمز عبور" required/><button className="btn-primary w-full" disabled={loading}>{loading?"در حال ورود...":"ورود"}</button><p className="text-sm">حساب ندارید؟ <Link className="text-sky-600" href={registerHref}>ثبت‌نام</Link></p></form></main>;
}
