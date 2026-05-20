import type { ReactNode } from "react";
import { XCircle } from "lucide-react";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { dashboardDefaultListFilters, type ListFilterState } from "@/features/dashboard/store/dashboard-page-store";

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
      <h2 className="mb-4 text-lg font-bold md:text-xl">Ø¬Ù„Ø³Ø§Øª Ù…Ù†</h2>
      <p className="-mt-2 mb-4 text-sm text-slate-400">Ø¬Ù„Ø³Ù‡â€ŒÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ø®ÙˆØ¯ØªØ§Ù† Ø±Ø²Ø±Ùˆ Ú©Ø±Ø¯Ù‡â€ŒØ§ÛŒØ¯ Ù‡Ù…Ø±Ø§Ù‡ Ø¨Ø§ Ø²Ù…Ø§Ù† Ùˆ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ Ø«Ø¨Øªâ€ŒØ´Ø¯Ù‡ Ù†Ù…Ø§ÛŒØ´ Ø¯Ø§Ø¯Ù‡ Ù…ÛŒâ€ŒØ´ÙˆÙ†Ø¯.</p>
      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className="input h-10" placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ø¬Ù„Ø³Ø§Øª (Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ØŒ Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡ØŒ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§...)" value={sessionFilterDraft.query} onChange={(e) => {
          const value = e.target.value;
          setSessionFilterDraft((prev) => ({ ...prev, query: value }));
          setSessionFilters((prev) => ({ ...prev, query: value }));
        }} />
        <button type="button" className="btn-ghost h-10" onClick={() => setSessionFilterOpen((prev) => !prev)}>ÙÛŒÙ„ØªØ± Ø¨ÛŒØ´ØªØ±</button>
        {sessionFilterOpen && (
          <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Ø§Ø² ØªØ§Ø±ÛŒØ®</label>
              <input className="input h-10" type="date" value={sessionFilterDraft.from} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">ØªØ§ ØªØ§Ø±ÛŒØ®</label>
              <input className="input h-10" type="date" value={sessionFilterDraft.to} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, to: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Ù…Ø±ØªØ¨â€ŒØ³Ø§Ø²ÛŒ</label>
              <select className="input h-10" value={sessionFilterDraft.sort} onChange={(e) => setSessionFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}>
                <option value="time-asc">Ø²Ù…Ø§Ù† (Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ±ÛŒÙ†)</option>
                <option value="time-desc">Ø²Ù…Ø§Ù† (Ø¯ÙˆØ±ØªØ±ÛŒÙ†)</option>
                <option value="name-asc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (Ø§Ù„Ù-ÛŒ)</option>
                <option value="name-desc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (ÛŒ-Ø§Ù„Ù)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">ÙÛŒÙ„ØªØ± Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`rounded-full border px-3 py-1 text-xs transition ${sessionFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() => setSessionFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}>Ù‡Ù…Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</button>
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
              }}>Ø§Ø¹Ù…Ø§Ù„ ÙÛŒÙ„ØªØ±</button>
              <button type="button" className="btn-ghost" onClick={() => {
                setSessionFilterDraft(() => ({ ...dashboardDefaultListFilters }));
                setSessionFilters(() => ({ ...dashboardDefaultListFilters }));
                setSessionFilterOpen(false);
              }}>Ø±ÛŒØ³Øª</button>
            </div>
          </div>
        )}
      </div>

      {nextSession && nextSession.timeSlot?.startTime && (
        <div className="mb-4 rounded-xl border border-cyan-700/40 bg-cyan-500/10 p-3 text-sm text-cyan-200">
          <div className="font-semibold">Ø¬Ù„Ø³Ù‡ Ø¨Ø¹Ø¯ÛŒ Ø´Ù…Ø§</div>
          <div className="mt-1 text-xs text-slate-300">{highlightText(nextSession.schedule?.title || "Ø¬Ù„Ø³Ù‡", sessionFilters.query)} Â· {formatJalaliDateTime(new Date(nextSession.timeSlot.startTime))}</div>
          {minutesUntil(new Date(nextSession.timeSlot.startTime)) >= 0 && <div className="mt-1 text-xs text-slate-300">Ø´Ø±ÙˆØ¹ ØªØ§ {formatDurationFromMinutesFa(minutesUntil(new Date(nextSession.timeSlot.startTime)))} Ø¯ÛŒÚ¯Ø±</div>}
        </div>
      )}

      <div className="space-y-3">
        {filteredMySessions.length === 0 && <div className="text-sm text-slate-400">Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ ÙÛŒÙ„ØªØ± Ø§Ù†ØªØ®Ø§Ø¨ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.</div>}
        {filteredMySessions.map((s) => (
          <div key={s.id} className="rounded-xl surface-block p-3">
            <div className="font-medium break-words">{highlightText(s.schedule?.title || "-", sessionFilters.query)}</div>
            <div className="mt-2 flex items-center gap-2">
              <UserAvatar src={s.schedule?.user?.avatarUrl} alt="host avatar" sizeClassName="h-8 w-8" iconSize={14} onClick={() => openAvatarPreview(s.schedule?.user?.avatarUrl, s.schedule?.user?.username || s.schedule?.user?.phone || "Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡")} />
              <div className="text-sm text-slate-400">Ø§Ø±Ø§Ø¦Ù‡â€ŒØ¯Ù‡Ù†Ø¯Ù‡: {highlightText(s.schedule?.user?.username || s.schedule?.user?.phone || "-", sessionFilters.query)}</div>
            </div>
            <div className="text-sm text-slate-400">Ø²Ù…Ø§Ù† Ø´Ø±ÙˆØ¹: {s.timeSlot?.startTime ? formatJalaliDateTime(new Date(s.timeSlot.startTime)) : "-"}</div>
            <div className="text-sm text-slate-400">Ø²Ù…Ø§Ù† Ù¾Ø§ÛŒØ§Ù†: {s.timeSlot?.endTime ? formatJalaliDateTime(new Date(s.timeSlot.endTime)) : "-"}</div>
            <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
              <div className="mb-2 text-xs text-slate-400">Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ ÙØ±Ù…</div>
              {renderAnswers(s.answers, s.schedule?.questions, sessionFilters.query)}
            </div>
            <div className="mt-3">
              <button type="button" className="btn-danger" onClick={() => setCancelTarget(s)} aria-label="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ" title="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ">
                <XCircle size={14} className="icon-danger" />
                <span>Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

