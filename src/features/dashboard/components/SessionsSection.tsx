import type { ReactNode } from "react";
import { XCircle } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { dashboardDefaultListFilters, type ListFilterState } from "@/store/dashboard-page-store";

type Props = {
  sessionFilterDraft: ListFilterState;
  setSessionFilterDraft: (updater: (prev: ListFilterState) => ListFilterState) => void;
  setSessionFilters: (updater: (prev: ListFilterState) => ListFilterState) => void;
  sessionFilterOpen: boolean;
  setSessionFilterOpen: (updater: (prev: boolean) => boolean) => void;
  sessionScheduleOptions: Array<{ id: string; title: string }>;
  nextSession: any;
  sessionFilters: ListFilterState;
  filteredMySessions: any[];
  highlightText: (value: any, query: string) => ReactNode;
  formatJalaliDateTime: (d: Date) => string;
  minutesUntil: (d: Date) => number;
  formatDurationFromMinutesFa: (v: number) => string;
  renderAnswers: (answers: any, questions: any, query: string) => ReactNode;
  openAvatarPreview: (src: string | null | undefined, name: string) => void;
  setCancelTarget: (b: any) => void;
};

export function SessionsSection(props: Props) {
  const {
    sessionFilterDraft,
    setSessionFilterDraft,
    setSessionFilters,
    sessionFilterOpen,
    setSessionFilterOpen,
    sessionScheduleOptions,
    nextSession,
    sessionFilters,
    filteredMySessions,
    highlightText,
    formatJalaliDateTime,
    minutesUntil,
    formatDurationFromMinutesFa,
    renderAnswers,
    openAvatarPreview,
    setCancelTarget,
  } = props;

  return (
    <section className="card p-4 md:mt-2">
      <h2 className="mb-4 text-lg font-bold md:text-xl">جلسات من</h2>
      <p className="-mt-2 mb-4 text-sm text-slate-400">جلسه‌هایی که خودتان رزرو کرده‌اید همراه با زمان و پاسخ‌های ثبت‌شده نمایش داده می‌شوند.</p>
      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className="input h-10" placeholder="جستجو در جلسات (نام برنامه، ارائه‌دهنده، پاسخ‌ها...)" value={sessionFilterDraft.query} onChange={(e) => {
          const value = e.target.value;
          setSessionFilterDraft((prev) => ({ ...prev, query: value }));
          setSessionFilters((prev) => ({ ...prev, query: value }));
        }} />
        <button type="button" className="btn-ghost h-10" onClick={() => setSessionFilterOpen((prev) => !prev)}>فیلتر بیشتر</button>
        {sessionFilterOpen && (
          <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">از تاریخ</label>
              <input className="input h-10" type="date" value={sessionFilterDraft.from} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">تا تاریخ</label>
              <input className="input h-10" type="date" value={sessionFilterDraft.to} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, to: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">مرتب‌سازی</label>
              <select className="input h-10" value={sessionFilterDraft.sort} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}>
                <option value="time-asc">زمان (نزدیک‌ترین)</option>
                <option value="time-desc">زمان (دورترین)</option>
                <option value="name-asc">نام برنامه (الف-ی)</option>
                <option value="name-desc">نام برنامه (ی-الف)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">فیلتر برنامه‌ها</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`rounded-full border px-3 py-1 text-xs transition ${sessionFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() => setSessionFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}>همه برنامه‌ها</button>
                {sessionScheduleOptions.map((s) => {
                  const active = sessionFilterDraft.scheduleIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() =>
                      setSessionFilterDraft((prev) => ({ ...prev, scheduleIds: active ? prev.scheduleIds.filter((id) => id !== s.id) : [...prev.scheduleIds, s.id] }))
                    }>
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => {
                setSessionFilters(() => sessionFilterDraft);
                setSessionFilterOpen(false);
              }}>اعمال فیلتر</button>
              <button type="button" className="btn-ghost" onClick={() => {
                setSessionFilterDraft(() => ({ ...dashboardDefaultListFilters }));
                setSessionFilters(() => ({ ...dashboardDefaultListFilters }));
                setSessionFilterOpen(false);
              }}>ریست</button>
            </div>
          </div>
        )}
      </div>

      {nextSession && nextSession.timeSlot?.startTime && (
        <div className="mb-4 rounded-xl border border-cyan-700/40 bg-cyan-500/10 p-3 text-sm text-cyan-200">
          <div className="font-semibold">جلسه بعدی شما</div>
          <div className="mt-1 text-xs text-slate-300">{highlightText(nextSession.schedule?.title || "جلسه", sessionFilters.query)} · {formatJalaliDateTime(new Date(nextSession.timeSlot.startTime))}</div>
          {minutesUntil(new Date(nextSession.timeSlot.startTime)) >= 0 && <div className="mt-1 text-xs text-slate-300">شروع تا {formatDurationFromMinutesFa(minutesUntil(new Date(nextSession.timeSlot.startTime)))} دیگر</div>}
        </div>
      )}

      <div className="space-y-3">
        {filteredMySessions.length === 0 && <div className="text-sm text-slate-400">نتیجه‌ای برای فیلتر انتخابی پیدا نشد.</div>}
        {filteredMySessions.map((s) => (
          <div key={s.id} className="rounded-xl surface-block p-3">
            <div className="font-medium break-words">{highlightText(s.schedule?.title || "-", sessionFilters.query)}</div>
            <div className="mt-2 flex items-center gap-2">
              <UserAvatar src={s.schedule?.user?.avatarUrl} alt="host avatar" sizeClassName="h-8 w-8" iconSize={14} onClick={() => openAvatarPreview(s.schedule?.user?.avatarUrl, s.schedule?.user?.username || s.schedule?.user?.phone || "ارائه‌دهنده")} />
              <div className="text-sm text-slate-400">ارائه‌دهنده: {highlightText(s.schedule?.user?.username || s.schedule?.user?.phone || "-", sessionFilters.query)}</div>
            </div>
            <div className="text-sm text-slate-400">زمان شروع: {s.timeSlot?.startTime ? formatJalaliDateTime(new Date(s.timeSlot.startTime)) : "-"}</div>
            <div className="text-sm text-slate-400">زمان پایان: {s.timeSlot?.endTime ? formatJalaliDateTime(new Date(s.timeSlot.endTime)) : "-"}</div>
            <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
              <div className="mb-2 text-xs text-slate-400">پاسخ‌های فرم</div>
              {renderAnswers(s.answers, s.schedule?.questions, sessionFilters.query)}
            </div>
            <div className="mt-3">
              <button type="button" className="btn-danger" onClick={() => setCancelTarget(s)} aria-label="کنسل رزرو" title="کنسل رزرو">
                <XCircle size={14} className="icon-danger" />
                <span>کنسل رزرو</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
