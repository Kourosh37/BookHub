"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { requestOtpSchema, verifyOtpSchema } from "@/lib/validations";
import { apiFetch, authMeResponseSchema, simpleOkSchema } from "@/lib/api-client";
import { OTP_DELAY_NOTICE } from "@/lib/ui-messages";
import { PublicHeader } from "@/components/public-header";

function resolveNextPath(raw: string) {
  if (!raw || !raw.startsWith("/")) return "/dashboard";
  if (raw === "/login" || raw.startsWith("/login?")) return "/dashboard";
  if (raw === "/register" || raw.startsWith("/register?")) return "/dashboard";
  return raw;
}

const registerFormSchema = requestOtpSchema.safeExtend({ mode: z.literal("register") });
type RegisterInput = z.infer<typeof registerFormSchema>;
type VerifyInput = z.infer<typeof verifyOtpSchema>;

export default function RegisterPage() {
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const nextParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("next") || "";
  }, []);
  const nextPath = useMemo(() => resolveNextPath(nextParam), [nextParam]);

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { mode: "register", username: "", phone: "", password: "", confirmPassword: "" },
  });
  const verifyForm = useForm<VerifyInput>({ resolver: zodResolver(verifyOtpSchema), defaultValues: { phone: "", code: "" } });

  useEffect(() => {
    apiFetch("/api/auth/me", { cache: "no-store" }, authMeResponseSchema)
      .then(() => window.location.replace(nextPath))
      .catch(() => undefined);
  }, [nextPath]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  function extractRetryAfterSeconds(errorMessage: string) {
    const match = errorMessage.match(/(\d+)/);
    return match ? Number(match[1]) : 0;
  }

  const requestOtp = registerForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/request-otp",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) },
        simpleOkSchema,
      );
      verifyForm.setValue("phone", values.phone);
      setOtpPhone(values.phone);
      setResendCooldown(120);
      setCodeSent(true);
      toast.success("کد تایید ارسال شد");
    } catch (e: any) {
      const message = e?.message || "ارسال کد ناموفق بود";
      const retryAfter = extractRetryAfterSeconds(message);
      if (retryAfter > 0) setResendCooldown(retryAfter);
      toast.error(message);
    }
  });

  async function resendOtp() {
    const phone = verifyForm.getValues("phone") || otpPhone;
    if (!phone || resendCooldown > 0) return;
    try {
      await apiFetch(
        "/api/auth/request-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "register",
            username: registerForm.getValues("username"),
            phone,
            password: registerForm.getValues("password"),
            confirmPassword: registerForm.getValues("confirmPassword"),
          }),
        },
        simpleOkSchema,
      );
      setResendCooldown(120);
      toast.success("کد تایید دوباره ارسال شد");
    } catch (e: any) {
      const message = e?.message || "ارسال مجدد ناموفق بود";
      const retryAfter = extractRetryAfterSeconds(message);
      if (retryAfter > 0) setResendCooldown(retryAfter);
      toast.error(message);
    }
  }

  const verifyOtp = verifyForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/verify-otp",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) },
        z.object({ ok: z.boolean().optional() }).passthrough(),
      );
      toast.success("حساب شما ساخته شد");
      window.location.replace(nextPath);
    } catch (e: any) {
      toast.error(e?.message || "کد تایید نامعتبر است");
    }
  });

  return (
    <main className="auth-shell page-shell min-h-screen py-4 sm:py-6">
      <PublicHeader compact mobileLayout />
      <section className="mx-auto max-w-2xl">
        <div className="card auth-panel space-y-4 p-5 lg:p-6">
          <div>
            <h1 className="text-2xl font-extrabold">ساخت حساب جدید</h1>
            <p className="mt-1 text-sm text-slate-400">فقط چند قدم تا فعال‌سازی حساب شما.</p>
          </div>

          {!codeSent ? (
            <form onSubmit={requestOtp} autoComplete="off" className="space-y-4">
              <input className="input h-11" placeholder="نام کاربری" {...registerForm.register("username")} />
              {registerForm.formState.errors.username && <p className="text-xs text-rose-400">{registerForm.formState.errors.username.message as string}</p>}

              <input className="input h-11" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="tel" placeholder="09xxxxxxxxx" dir="ltr" {...registerForm.register("phone")} />
              {registerForm.formState.errors.phone && <p className="text-xs text-rose-400">{registerForm.formState.errors.phone.message}</p>}

              <div className="relative">
                <input className="input h-11 ps-10" type={showPassword ? "text" : "password"} placeholder="رمز عبور" {...registerForm.register("password")} />
                <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowPassword((p) => !p)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {registerForm.formState.errors.password && <p className="text-xs text-rose-400">{registerForm.formState.errors.password.message as string}</p>}

              <div className="relative">
                <input className="input h-11 ps-10" type={showConfirmPassword ? "text" : "password"} placeholder="تکرار رمز عبور" {...registerForm.register("confirmPassword")} />
                <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowConfirmPassword((p) => !p)}>
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {registerForm.formState.errors.confirmPassword && <p className="text-xs text-rose-400">{registerForm.formState.errors.confirmPassword.message as string}</p>}

              <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
              <button className="btn-primary h-11 w-full" disabled={registerForm.formState.isSubmitting}>{registerForm.formState.isSubmitting ? "در حال ارسال..." : "ارسال کد تایید"}</button>
              <p className="text-sm">حساب دارید؟ <Link className="auth-switch-link" href="/login">ورود</Link></p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} autoComplete="off" className="space-y-4">
              <input type="hidden" {...verifyForm.register("phone")} />
              <div className="rounded-xl border border-cyan-700/60 bg-cyan-500/10 p-3 text-sm text-cyan-200">
                کد فعال‌سازی برای شماره <span dir="ltr" className="font-bold">{otpPhone}</span> ارسال شد.
              </div>
              <input className="input h-11" type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder="کد ۶ رقمی" dir="ltr" {...verifyForm.register("code")} />
              {verifyForm.formState.errors.code && <p className="text-xs text-rose-400">{verifyForm.formState.errors.code.message}</p>}
              <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
              <div className="flex items-center justify-between gap-2 text-xs">
                <button type="button" className="auth-switch-link disabled:opacity-50" disabled={resendCooldown > 0} onClick={resendOtp}>
                  {resendCooldown > 0 ? `ارسال مجدد تا ${resendCooldown} ثانیه` : "ارسال مجدد کد"}
                </button>
                <button
                  type="button"
                  className="auth-switch-link"
                  onClick={() => {
                    setCodeSent(false);
                    verifyForm.setValue("code", "");
                  }}
                >
                  تغییر شماره موبایل
                </button>
              </div>
              <button className="btn-primary h-11 w-full" disabled={verifyForm.formState.isSubmitting}>{verifyForm.formState.isSubmitting ? "در حال بررسی..." : "تایید و ورود"}</button>
              <p className="text-sm">حساب دارید؟ <Link className="auth-switch-link" href="/login">ورود</Link></p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
