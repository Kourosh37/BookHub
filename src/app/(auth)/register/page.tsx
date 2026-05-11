"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const payload = { username: form.get("username"), password: form.get("password") };
    const reg = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const regData = await reg.json();
    if (!reg.ok) {
      setLoading(false);
      return toast.error(regData.details || regData.error || "ثبت‌نام ناموفق بود");
    }

    const login = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const loginData = await login.json();
    setLoading(false);
    if (!login.ok) return toast.error(loginData.details || loginData.error || "ورود خودکار ناموفق بود");

    toast.success("حساب ساخته شد");
    router.push("/dashboard");
  }

  return <main className="mx-auto max-w-md p-6"><form onSubmit={onSubmit} className="card space-y-4 p-6"><h1 className="text-xl font-bold">ثبت‌نام</h1><input className="input" name="username" placeholder="نام کاربری" required/><input className="input" name="password" type="password" minLength={6} placeholder="رمز عبور" required/><button className="btn-primary w-full" disabled={loading}>{loading?"در حال ثبت...":"ایجاد حساب"}</button><p className="text-sm">حساب دارید؟ <Link className="text-sky-600" href="/login">ورود</Link></p></form></main>;
}
