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

  const requestOtp = registerForm.handleSubmit(async (values) => {
    try {
      await apiFetch(
        "/api/auth/request-otp",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) },
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
      toast.success("حساب شما ساخته شد");
      window.location.replace(nextPath);
    } catch (e: any) {
      toast.error(e?.message || "کد تایید نامعتبر است");
    }
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-4 text-center">
        <div className="text-sm text-slate-400">بوک هاب</div>
      </div>
      {!codeSent ? (
        <form onSubmit={requestOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">ثبت‌نام</h1>
          <input className="input" placeholder="نام کاربری" {...registerForm.register("username")} />
          {registerForm.formState.errors.username && <p className="text-xs text-rose-400">{registerForm.formState.errors.username.message as string}</p>}

          <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" dir="ltr" {...registerForm.register("phone")} />
          {registerForm.formState.errors.phone && <p className="text-xs text-rose-400">{registerForm.formState.errors.phone.message}</p>}

          <div className="relative">
            <input className="input ps-10" type={showPassword ? "text" : "password"} placeholder="رمز عبور" {...registerForm.register("password")} />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {registerForm.formState.errors.password && <p className="text-xs text-rose-400">{registerForm.formState.errors.password.message as string}</p>}

          <div className="relative">
            <input className="input ps-10" type={showConfirmPassword ? "text" : "password"} placeholder="تکرار رمز عبور" {...registerForm.register("confirmPassword")} />
            <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowConfirmPassword((p) => !p)}>
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {registerForm.formState.errors.confirmPassword && <p className="text-xs text-rose-400">{registerForm.formState.errors.confirmPassword.message as string}</p>}

          <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
          <button className="btn-primary w-full" disabled={registerForm.formState.isSubmitting}>{registerForm.formState.isSubmitting ? "در حال ارسال..." : "ارسال کد تایید"}</button>
          <p className="text-sm">حساب دارید؟ <Link className="text-sky-600" href="/login">ورود</Link></p>
        </form>
      ) : (
        <form onSubmit={verifyOtp} autoComplete="off" className="card space-y-4 p-6">
          <h1 className="text-xl font-bold">تایید کد</h1>
          <input type="hidden" {...verifyForm.register("phone")} />
          <input className="input" placeholder="کد ۶ رقمی" dir="ltr" {...verifyForm.register("code")} />
          {verifyForm.formState.errors.code && <p className="text-xs text-rose-400">{verifyForm.formState.errors.code.message}</p>}
          <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
          <button className="btn-primary w-full" disabled={verifyForm.formState.isSubmitting}>{verifyForm.formState.isSubmitting ? "در حال بررسی..." : "تایید و ورود"}</button>
          <p className="text-sm">حساب دارید؟ <Link className="text-sky-600" href="/login">ورود</Link></p>
        </form>
      )}
    </main>
  );
}
