import type { SmsSettings } from "@/features/admin/types/admin";

type SmsCountCard = { key: string; label: string; value: number };

type Props = {
  smsCountCards: SmsCountCard[];
  smsSaving: boolean;
  smsSettings: SmsSettings | null;
  updateSmsSetting: (next: SmsSettings) => Promise<void>;
};

export function AdminSmsSection({ smsCountCards, smsSaving, smsSettings, updateSmsSetting }: Props) {
  return (
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
  );
}
