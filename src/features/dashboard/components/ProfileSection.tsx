import { ChevronDown, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { AvatarUploader } from "@/components/avatar-uploader";
import { OTP_DELAY_NOTICE } from "@/lib/ui-messages";

type Props = {
  profileSections: any;
  toggleProfileSection: (k: "username" | "avatar" | "password" | "delete") => void;
  profileLoading: boolean;
  setProfileLoading: (v: boolean) => void;
  profileUsername: string;
  setProfileUsername: (v: string) => void;
  queryClient: any;
  user: any;
  openAvatarPreview: (src: string | null | undefined, name: string) => void;
  bumpAvatarRefreshToken: () => void;
  requestingPasswordOtp: boolean;
  passwordOtpCooldown: number;
  setRequestingPasswordOtp: (v: boolean) => void;
  setPasswordOtpCooldown: (v: number) => void;
  passwordCode: string;
  setPasswordCode: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (v: string) => void;
  showNewPassword: boolean;
  setShowNewPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean | ((p: boolean) => boolean)) => void;
  setDeleteAccountOpen: (v: boolean) => void;
};

export function ProfileSection(props: Props) {
  const {
    profileSections,
    toggleProfileSection,
    profileLoading,
    setProfileLoading,
    profileUsername,
    setProfileUsername,
    queryClient,
    user,
    openAvatarPreview,
    bumpAvatarRefreshToken,
    requestingPasswordOtp,
    passwordOtpCooldown,
    setRequestingPasswordOtp,
    setPasswordOtpCooldown,
    passwordCode,
    setPasswordCode,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    setDeleteAccountOpen,
  } = props;

  return (
    <section className="card space-y-4 p-4 md:mt-2">
      <h2 className="text-lg font-bold md:text-xl">پروفایل</h2>
      <p className="text-sm text-slate-400">مدیریت نام کاربری، رمز عبور، عکس پروفایل و حذف حساب کاربری.</p>
      <div className="space-y-3">
        <div className="rounded-2xl surface-block">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium" onClick={() => toggleProfileSection("username")} aria-expanded={profileSections.username}>
            تغییر نام کاربری
            <ChevronDown size={16} className={`transition ${profileSections.username ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${profileSections.username ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <form
              className="space-y-2 overflow-hidden px-4 pb-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setProfileLoading(true);
                const res = await fetch("/api/profile", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username: profileUsername }),
                });
                const data = await res.json();
                setProfileLoading(false);
                if (!res.ok) return toast.error(data.details || data.error || "خطا");
                queryClient.setQueryData(["auth", "me"], data);
                toast.success("پروفایل به‌روزرسانی شد");
              }}
            >
              <label className="block text-sm text-slate-300">نام کاربری</label>
              <input className="input" value={profileUsername} onChange={(e) => setProfileUsername(e.target.value)} />
              <button className="btn-primary" disabled={profileLoading}>{profileLoading ? "در حال ذخیره..." : "ذخیره نام کاربری"}</button>
            </form>
          </div>
        </div>

        <div className="rounded-2xl surface-block">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium" onClick={() => toggleProfileSection("avatar")} aria-expanded={profileSections.avatar}>
            عکس پروفایل
            <ChevronDown size={16} className={`transition ${profileSections.avatar ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${profileSections.avatar ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden px-4 pb-4">
              <AvatarUploader
                currentAvatarUrl={user?.avatarUrl}
                onPreview={() => openAvatarPreview(user?.avatarUrl, user?.username || user?.phone || "کاربر")}
                onUploaded={(avatarUrl) => {
                  queryClient.setQueryData(["auth", "me"], (prev: any) => ({ ...(prev || {}), avatarUrl }));
                  bumpAvatarRefreshToken();
                  void Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
                    queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
                    queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
                  ]);
                }}
                onRemoved={() => {
                  queryClient.setQueryData(["auth", "me"], (prev: any) => ({ ...(prev || {}), avatarUrl: null }));
                  bumpAvatarRefreshToken();
                  void Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] }),
                    queryClient.invalidateQueries({ queryKey: ["bookings", "mine"] }),
                    queryClient.invalidateQueries({ queryKey: ["schedules", "my"] }),
                  ]);
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl surface-block">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium" onClick={() => toggleProfileSection("password")} aria-expanded={profileSections.password}>
            تغییر رمز عبور
            <ChevronDown size={16} className={`transition ${profileSections.password ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${profileSections.password ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="space-y-2 overflow-hidden px-4 pb-4">
              <button
                type="button"
                className="btn-ghost"
                onClick={async () => {
                  if (requestingPasswordOtp || passwordOtpCooldown > 0) return;
                  try {
                    setRequestingPasswordOtp(true);
                    const res = await fetch("/api/profile/password/request-otp", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      const msg = data.details || data.error || "خطا";
                      const match = String(msg).match(/(\d+)/);
                      if (match) setPasswordOtpCooldown(Number(match[1]));
                      return toast.error(msg);
                    }
                    setPasswordOtpCooldown(120);
                    toast.success("کد تایید ارسال شد");
                  } finally {
                    setRequestingPasswordOtp(false);
                  }
                }}
                disabled={requestingPasswordOtp || passwordOtpCooldown > 0}
              >
                {requestingPasswordOtp ? "در حال ارسال..." : passwordOtpCooldown > 0 ? `ارسال مجدد تا ${passwordOtpCooldown} ثانیه` : "ارسال کد تایید"}
              </button>
              <p className="text-xs text-slate-400">{OTP_DELAY_NOTICE}</p>
              <input className="input" type="tel" inputMode="numeric" pattern="[0-9۰-۹٠-٩]*" autoComplete="one-time-code" placeholder="کد تایید" value={passwordCode} onChange={(e) => setPasswordCode(e.target.value)} />
              <div className="relative">
                <input className="input ps-10" type={showNewPassword ? "text" : "password"} placeholder="رمز عبور جدید" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowNewPassword((p) => !p)}>{showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <div className="relative">
                <input className="input ps-10" type={showConfirmPassword ? "text" : "password"} placeholder="تکرار رمز عبور جدید" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} />
                <button type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" onClick={() => setShowConfirmPassword((p) => !p)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
              <button
                className="btn-primary"
                onClick={async () => {
                  const res = await fetch("/api/profile/password/confirm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: passwordCode, newPassword, confirmPassword: confirmNewPassword }),
                  });
                  const data = await res.json();
                  if (!res.ok) return toast.error(data.details || data.error || "خطا");
                  toast.success("رمز عبور تغییر کرد");
                  setPasswordCode("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
              >
                تایید تغییر رمز
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium text-rose-200" onClick={() => toggleProfileSection("delete")} aria-expanded={profileSections.delete}>
            حذف اکانت
            <ChevronDown size={16} className={`transition ${profileSections.delete ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${profileSections.delete ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden px-4 pb-4">
              <button className="btn-danger" onClick={() => setDeleteAccountOpen(true)}>حذف حساب کاربری</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
