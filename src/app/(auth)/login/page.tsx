"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordLoginSchema, phoneSchema, verifyOtpSchema } from "@/lib/validations";
import { apiFetch, authMeResponseSchema, simpleOkSchema } from "@/lib/api-client";
import { OTP_DELAY_NOTICE } from "@/lib/ui-messages";

function resolveNextPath(raw: string) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  if (raw === "/register" || raw.startsWith("/register?")) return "/dashboard";
  return raw;
}

const phoneLoginSchema = z.object({ phone: phoneSchema });
type PhoneLoginInput = z.infer<typeof phoneLoginSchema>;
type VerifyInput = z.infer<typeof verifyOtpSchema>;
type PasswordInput = z.infer<typeof passwordLoginSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<"phone" | "password">("phone");
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);
  const nextPath = useMemo(() => resolveNextPath(nextParam), [nextParam]);

  const phoneForm = useForm<PhoneLoginInput>({ resolver: zodResolver(phoneLoginSchema), defaultValues: { phone: "" } });
  const verifyForm = useForm<VerifyInput>({ resolver: zodResolver(verifyOtpSchema), defaultValues: { phone: "", code: "" } });
  const passwordForm = useForm<PasswordInput>({ resolver: zodResolver(passwordLoginSchema), defaultValues: { username: "", password: "" } });

  useEffect(() => {
    apiFetch("/api/auth/me", { cache: "no-store" }, authMeResponseSchema)
      .then(() => window.location.replace(nextPath))
      .catch(() => undefined);
  }, [nextPath]);

  const requestOtp = phoneForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/request-otp",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "login_phone", phone: values.phone }) },
        simpleOkSchema,
      );
      verifyForm.setValue("phone", values.phone);
      setCodeSent(true);
      toast.success("کد تایید ارسال شد");
    } catch (e: any) {
      toast.error(e?.message || "ارسال کد ناموفق بود");
    }
  });

  const verifyOtp = verifyForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/verify-otp",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) },
        z.object({ ok: z.boolean().optional() }).passthrough(),
      );
      window.location.replace(nextPath);
    } catch (e: any) {
      toast.error(e?.message || "کد تایید نامعتبر است");
    }
  });

  const loginWithPassword = passwordForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/login-password",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) },
        z.object({ ok: z.boolean().optional() }).passthrough(),
      );
      window.location.replace(nextPath);
    } catch (e: any) {
      toast.error(e?.message || "ورود ناموفق بود");
    }
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-4 text-center">
        <div className="text-sm text-slate-400">بوک هاب</div>
      </div>
      <div className="mb-3 flex gap-2">
        <button className={`btn ${mode === "phone" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setMode("phone")} type="button">ورود با موبایل</button>
        <button className={`btn ${mode === "password" ? "bg-cyan-500 text-slate-950" : "btn-ghost"}`} onClick={() => setMode("password")} type="button">ورود با رمز</button>
      </div>

      {mode === "phone" ? (
        !codeSent ? (
          <form onSubmit={requestOtp} className="card space-y-4 p-6">
            <h1 className="text-xl font-bold">ورود با شماره موبایل</h1>
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" dir="ltr" {...phoneForm.register("phone")} />
            {phoneForm.formState.errors.phone && <p className="text-xs text-rose-400">{phoneForm.formState.errors.phone.message}</p>}
            <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
            <button className="btn-primary w-full" disabled={phoneForm.formState.isSubmitting}>{phoneForm.formState.isSubmitting ? "در حال ارسال..." : "ارسال کد تایید"}</button>
            <p className="text-sm">حساب ندارید؟ <Link className="text-sky-600" href="/register">ثبت‌نام</Link></p>
          </form>
        ) : (
          <form onSubmit={verifyOtp} className="card space-y-4 p-6">
            <h1 className="text-xl font-bold">تایید کد ورود</h1>
            <input type="hidden" {...verifyForm.register("phone")} />
            <input className="input" placeholder="کد ۶ رقمی" dir="ltr" {...verifyForm.register("code")} />
            {verifyForm.formState.errors.code && <p className="text-xs text-rose-400">{verifyForm.formState.errors.code.message}</p>}
            <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
            <button className="btn-primary w-full" disabled={verifyForm.formState.isSubmitting}>{verifyForm.formState.isSubmitting ? "در حال بررسی..." : "ورود"}</button>
            <p className="text-sm">حساب ندارید؟ <Link className="text-sky-600" href="/register">ثبت‌نام</Link></p>
          </form>
        )
      ) : (
        <form onSubmit={loginWithPassword} className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">ورود با نام کاربری و رمز عبور</h1>
          <input className="input" placeholder="نام کاربری" {...passwordForm.register("username")} />
          {passwordForm.formState.errors.username && <p className="text-xs text-rose-400">{passwordForm.formState.errors.username.message}</p>}
          <div className="relative">
            <input className="input ps-10" type={showPassword ? "text" : "password"} placeholder="رمز عبور" {...passwordForm.register("password")} />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordForm.formState.errors.password && <p className="text-xs text-rose-400">{passwordForm.formState.errors.password.message}</p>}
          <button className="btn-primary w-full" disabled={passwordForm.formState.isSubmitting}>{passwordForm.formState.isSubmitting ? "در حال ورود..." : "ورود"}</button>
          <p className="text-sm">حساب ندارید؟ <Link className="text-sky-600" href="/register">ثبت‌نام</Link></p>
        </form>
      )}
    </main>
  );
}
