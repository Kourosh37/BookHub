import { ChevronDown } from "lucide-react";
import type { SmsPreferences } from "@/lib/sms-preferences";

type Props = {
  settingsSections: any;
  toggleSettingsSection: (k: "sms") => void;
  smsPreferences: SmsPreferences;
  smsPreferencesSaving: boolean;
  smsPreferencesError: string;
  updateSmsPreferences: (next: SmsPreferences) => Promise<void>;
};

export function SettingsSection({ settingsSections, toggleSettingsSection, smsPreferences, smsPreferencesSaving, smsPreferencesError, updateSmsPreferences }: Props) {
  return (
    <section className="card space-y-4 p-4 md:mt-2">
      <h2 className="text-lg font-bold md:text-xl">تنظیمات</h2>

      <div className="space-y-3">
        <div className="rounded-2xl surface-block">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-right text-sm font-medium" onClick={() => toggleSettingsSection("sms")} aria-expanded={settingsSections.sms}>
            تنظیمات پیامک
            <ChevronDown size={16} className={`transition ${settingsSections.sms ? "rotate-180" : ""}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${settingsSections.sms ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="space-y-3 overflow-hidden px-4 pb-4">
              <p className="text-xs text-slate-400">با خاموش کردن هر گزینه، پیامک مربوطه برای شما ارسال نمی‌شود.</p>
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">رزرو جدید</span>
                    <span className="block text-xs text-slate-400">اطلاع‌رسانی ثبت رزرو جدید</span>
                  </span>
                  <input type="checkbox" checked={smsPreferences.bookingCreated} onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingCreated: e.target.checked })} disabled={smsPreferencesSaving} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">کنسل شدن رزرو</span>
                    <span className="block text-xs text-slate-400">اطلاع‌رسانی لغو رزرو</span>
                  </span>
                  <input type="checkbox" checked={smsPreferences.bookingCanceled} onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingCanceled: e.target.checked })} disabled={smsPreferencesSaving} />
                </label>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-sm">
                  <span>
                    <span className="block text-slate-200">یادآوری جلسه</span>
                    <span className="block text-xs text-slate-400">۱۰ دقیقه قبل از شروع جلسه</span>
                  </span>
                  <input type="checkbox" checked={smsPreferences.bookingReminder} onChange={(e) => updateSmsPreferences({ ...smsPreferences, bookingReminder: e.target.checked })} disabled={smsPreferencesSaving} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                {smsPreferencesSaving && <span className="text-cyan-200">در حال ذخیره تنظیمات...</span>}
                {smsPreferencesError && <span className="text-rose-300">{smsPreferencesError}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
