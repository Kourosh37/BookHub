import type { ReactNode, RefObject } from "react";
import { Copy, Download, FileImage, FileSpreadsheet, FileText, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { dashboardDefaultListFilters, type ListFilterState } from "@/features/dashboard/store/dashboard-page-store";

type Props = {
  exportMenuRef: RefObject<HTMLDivElement | null>;
  setIsExportMenuOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  isExportMenuOpen: boolean;
  bookingFilters: ListFilterState;
  exportBookingsAsPdf: () => Promise<void>;
  exportingPdf: boolean;
  exportBookingsAsImage: () => Promise<void>;
  exportingImage: boolean;
  bookingFilterDraft: ListFilterState;
  setBookingFilterDraft: (updater: (prev: ListFilterState) => ListFilterState) => void;
  setBookingFilters: (updater: (prev: ListFilterState) => ListFilterState) => void;
  bookingFilterOpen: boolean;
  setBookingFilterOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  bookingScheduleOptions: Array<{ id: string; title: string }>;
  filteredBookings: any[];
  highlightText: (value: any, query: string) => ReactNode;
  openAvatarPreview: (src: string | null | undefined, name: string) => void;
  formatJalaliDateTime: (d: Date) => string;
  renderAnswers: (answers: any, questions: any, query: string) => ReactNode;
  setCancelTarget: (b: any) => void;
};

export function BookingsSection(props: Props) {
  const {
    exportMenuRef,
    setIsExportMenuOpen,
    isExportMenuOpen,
    bookingFilters,
    exportBookingsAsPdf,
    exportingPdf,
    exportBookingsAsImage,
    exportingImage,
    bookingFilterDraft,
    setBookingFilterDraft,
    setBookingFilters,
    bookingFilterOpen,
    setBookingFilterOpen,
    bookingScheduleOptions,
    filteredBookings,
    highlightText,
    openAvatarPreview,
    formatJalaliDateTime,
    renderAnswers,
    setCancelTarget,
  } = props;

  return (
    <section className="card relative overflow-visible p-4 md:mt-2">
      <h2 className="mb-4 text-lg font-bold md:text-xl">Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒ Ù…Ù†</h2>
      <p className="-mt-2 mb-4 text-sm text-slate-400">Ù„ÛŒØ³Øª Ø±Ø²Ø±ÙˆÙ‡Ø§ÛŒÛŒ Ú©Ù‡ Ø¯ÛŒÚ¯Ø±Ø§Ù† Ø±ÙˆÛŒ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§ÛŒ Ø´Ù…Ø§ Ø«Ø¨Øª Ú©Ø±Ø¯Ù‡â€ŒØ§Ù†Ø¯ Ø±Ø§ Ø¨Ø¨ÛŒÙ†ÛŒØ¯ Ùˆ Ø¯Ø± ØµÙˆØ±Øª Ù†ÛŒØ§Ø² Ú©Ù†Ø³Ù„ Ú©Ù†ÛŒØ¯.</p>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm text-slate-300">ÙÛŒÙ„ØªØ± Ø¨Ø± Ø§Ø³Ø§Ø³ Ø¨Ø±Ù†Ø§Ù…Ù‡</label>
        <div ref={exportMenuRef} className="relative">
          <button type="button" onClick={() => setIsExportMenuOpen((prev) => !prev)} className="btn-ghost flex items-center gap-2" aria-haspopup="listbox" aria-expanded={isExportMenuOpen}>
            <Download size={16} />
            <span className="hidden sm:inline">Ø®Ø±ÙˆØ¬ÛŒ Ú¯Ø±ÙØªÙ†</span>
          </button>
          <div className={`dropdown-panel absolute left-0 z-50 mt-2 w-48 origin-top-left rounded-2xl shadow-xl transition-all duration-200 ${isExportMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}>
            <a className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" href={`/api/bookings/my/export?format=csv${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`} onClick={() => setIsExportMenuOpen(false)}>
              <FileText size={14} /> CSV
            </a>
            <a className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" href={`/api/bookings/my/export?format=xls${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`} onClick={() => setIsExportMenuOpen(false)}>
              <FileSpreadsheet size={14} /> Excel
            </a>
            <button type="button" className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" onClick={exportBookingsAsPdf} disabled={exportingPdf}>
              <FileText size={14} /> {exportingPdf ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª PDF" : "PDF"}
            </button>
            <button type="button" className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" onClick={exportBookingsAsImage} disabled={exportingImage}>
              <FileImage size={14} /> {exportingImage ? "Ø¯Ø± Ø­Ø§Ù„ Ø³Ø§Ø®Øª ØªØµÙˆÛŒØ±" : "ØªØµÙˆÛŒØ±"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className="input h-10" placeholder="Ø¬Ø³ØªØ¬Ùˆ Ø¯Ø± Ø±Ø²Ø±ÙˆÙ‡Ø§ (Ù†Ø§Ù…ØŒ Ø´Ù…Ø§Ø±Ù‡ØŒ Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§...)" value={bookingFilterDraft.query} onChange={(e) => {
          const value = e.target.value;
          setBookingFilterDraft((prev) => ({ ...prev, query: value }));
          setBookingFilters((prev) => ({ ...prev, query: value }));
        }} />
        <button type="button" className="btn-ghost h-10" onClick={() => setBookingFilterOpen((prev) => !prev)}>ÙÛŒÙ„ØªØ± Ø¨ÛŒØ´ØªØ±</button>
        {bookingFilterOpen && (
          <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Ø§Ø² ØªØ§Ø±ÛŒØ®</label>
              <input className="input h-10" type="date" value={bookingFilterDraft.from} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, from: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">ØªØ§ ØªØ§Ø±ÛŒØ®</label>
              <input className="input h-10" type="date" value={bookingFilterDraft.to} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, to: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Ù…Ø±ØªØ¨â€ŒØ³Ø§Ø²ÛŒ</label>
              <select className="input h-10" value={bookingFilterDraft.sort} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}>
                <option value="time-asc">Ø²Ù…Ø§Ù† (Ù†Ø²Ø¯ÛŒÚ©â€ŒØªØ±ÛŒÙ†)</option>
                <option value="time-desc">Ø²Ù…Ø§Ù† (Ø¯ÙˆØ±ØªØ±ÛŒÙ†)</option>
                <option value="name-asc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (Ø§Ù„Ù-ÛŒ)</option>
                <option value="name-desc">Ù†Ø§Ù… Ø¨Ø±Ù†Ø§Ù…Ù‡ (ÛŒ-Ø§Ù„Ù)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">ÙÛŒÙ„ØªØ± Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`rounded-full border px-3 py-1 text-xs transition ${bookingFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() => setBookingFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}>Ù‡Ù…Ù‡ Ø¨Ø±Ù†Ø§Ù…Ù‡â€ŒÙ‡Ø§</button>
                {bookingScheduleOptions.map((s) => {
                  const active = bookingFilterDraft.scheduleIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" className={`rounded-full border px-3 py-1 text-xs transition ${active ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() =>
                      setBookingFilterDraft((prev) => ({ ...prev, scheduleIds: active ? prev.scheduleIds.filter((id) => id !== s.id) : [...prev.scheduleIds, s.id] }))
                    }>
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => {
                setBookingFilters(() => bookingFilterDraft);
                setBookingFilterOpen(false);
              }}>Ø§Ø¹Ù…Ø§Ù„ ÙÛŒÙ„ØªØ±</button>
              <button type="button" className="btn-ghost" onClick={() => {
                setBookingFilterDraft(() => ({ ...dashboardDefaultListFilters }));
                setBookingFilters(() => ({ ...dashboardDefaultListFilters }));
                setBookingFilterOpen(false);
              }}>Ø±ÛŒØ³Øª</button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredBookings.length === 0 && <div className="text-sm text-slate-400">Ù†ØªÛŒØ¬Ù‡â€ŒØ§ÛŒ Ø¨Ø±Ø§ÛŒ ÙÛŒÙ„ØªØ± Ø§Ù†ØªØ®Ø§Ø¨ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯.</div>}
        {filteredBookings.map((b) => (
          <div key={b.id} className="rounded-xl surface-block p-3">
            <div className="font-medium break-words">{highlightText(b.schedule.title, bookingFilters.query)}</div>
            <div className="text-sm text-slate-400">Ù†Ø§Ù… Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡: {highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±", bookingFilters.query)}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡:</span>
              <span dir="ltr">{highlightText(b.bookedByUser?.phone || "-", bookingFilters.query)}</span>
              {b.bookedByUser?.phone && (
                <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-500/10 hover:text-cyan-300" onClick={async () => {
                  await navigator.clipboard.writeText(b.bookedByUser.phone);
                  toast.success("Ø´Ù…Ø§Ø±Ù‡ Ú©Ù¾ÛŒ Ø´Ø¯");
                }} aria-label="Ú©Ù¾ÛŒ Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡" title="Ú©Ù¾ÛŒ Ø´Ù…Ø§Ø±Ù‡ Ø±Ø²Ø±ÙˆÚ©Ù†Ù†Ø¯Ù‡">
                  <Copy size={12} />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <UserAvatar src={b.bookedByUser?.avatarUrl} alt="booker avatar" sizeClassName="h-8 w-8" iconSize={14} onClick={() => openAvatarPreview(b.bookedByUser?.avatarUrl, b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø±")} />
              <div className="text-xs text-slate-400">{highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "Ú©Ø§Ø±Ø¨Ø± Ù…Ù‡Ù…Ø§Ù†", bookingFilters.query)}</div>
            </div>
            <div className="text-sm text-slate-400">Ø²Ù…Ø§Ù†: {b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}</div>
            <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
              <div className="mb-2 text-xs text-slate-400">Ù¾Ø§Ø³Ø®â€ŒÙ‡Ø§ÛŒ ÙØ±Ù…</div>
              {renderAnswers(b.answers, b.schedule?.questions, bookingFilters.query)}
            </div>
            <div className="mt-3">
              <button type="button" className="btn-danger" onClick={() => setCancelTarget(b)} aria-label="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ" title="Ú©Ù†Ø³Ù„ Ø±Ø²Ø±Ùˆ">
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

