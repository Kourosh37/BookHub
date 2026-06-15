import type { ReactNode, RefObject } from "react";
import { Check, Copy, Download, FileImage, FileSpreadsheet, FileText, RotateCcw, Search, SlidersHorizontal, X, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { dashboardDefaultListFilters, type ListFilterState } from "@/features/dashboard/store/dashboard-page-store";
import { FilterModal } from "@/features/dashboard/components/FilterModal";

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
  const activeFilterCount =
    (bookingFilterDraft.from ? 1 : 0) +
    (bookingFilterDraft.to ? 1 : 0) +
    (bookingFilterDraft.sort !== dashboardDefaultListFilters.sort ? 1 : 0) +
    bookingFilterDraft.scheduleIds.length;

  return (
    <section className="card relative overflow-visible p-4 md:mt-2">
      <h2 className="mb-4 text-lg font-bold md:text-xl">رزروهای من</h2>
      <p className="-mt-2 mb-4 text-sm text-slate-400">لیست رزروهایی که دیگران روی برنامه‌های شما ثبت کرده‌اند را ببینید و در صورت نیاز کنسل کنید.</p>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm text-slate-300">فیلتر بر اساس برنامه</label>
        <div ref={exportMenuRef} className="relative">
          <button type="button" onClick={() => setIsExportMenuOpen((prev) => !prev)} className="btn-ghost flex items-center gap-2" aria-haspopup="listbox" aria-expanded={isExportMenuOpen}>
            <Download size={16} />
            <span className="hidden sm:inline">خروجی گرفتن</span>
          </button>
          <div className={`dropdown-panel absolute left-0 z-50 mt-2 w-48 origin-top-left rounded-2xl shadow-xl transition-all duration-200 ${isExportMenuOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}>
            <a className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" href={`/api/bookings/my/export?format=csv${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`} onClick={() => setIsExportMenuOpen(false)}>
              <FileText size={14} /> CSV
            </a>
            <a className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" href={`/api/bookings/my/export?format=xls${bookingFilters.scheduleIds.length > 0 ? `&scheduleId=${bookingFilters.scheduleIds.join(",")}` : ""}`} onClick={() => setIsExportMenuOpen(false)}>
              <FileSpreadsheet size={14} /> Excel
            </a>
            <button type="button" className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" onClick={exportBookingsAsPdf} disabled={exportingPdf}>
              <FileText size={14} /> {exportingPdf ? "در حال ساخت PDF" : "PDF"}
            </button>
            <button type="button" className="dropdown-option flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition" onClick={exportBookingsAsImage} disabled={exportingImage}>
              <FileImage size={14} /> {exportingImage ? "در حال ساخت تصویر" : "تصویر"}
            </button>
          </div>
        </div>
      </div>

      <div className={`relative mb-4 rounded-2xl border border-slate-700/40 bg-slate-500/5 p-3 ${bookingFilterOpen ? "z-50" : "z-30"}`}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input h-10 !pl-10 !pr-12" placeholder="جستجو در رزروها (نام، شماره، پاسخ‌ها...)" value={bookingFilterDraft.query} onChange={(e) => {
              const value = e.target.value;
              setBookingFilterDraft((prev) => ({ ...prev, query: value }));
              setBookingFilters((prev) => ({ ...prev, query: value }));
            }} />
            {bookingFilterDraft.query && (
              <button
                type="button"
                className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-500/15 hover:text-slate-100"
                onClick={() => {
                  setBookingFilterDraft((prev) => ({ ...prev, query: "" }));
                  setBookingFilters((prev) => ({ ...prev, query: "" }));
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>
          <button type="button" className={`btn-ghost h-10 justify-between sm:min-w-40 ${bookingFilterOpen ? "border-cyan-700/60" : ""}`} onClick={() => setBookingFilterOpen((prev) => !prev)} aria-expanded={bookingFilterOpen}>
            <span className="flex items-center gap-2"><SlidersHorizontal size={16} /> فیلتر بیشتر</span>
            {activeFilterCount > 0 && <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-xs text-slate-950">{activeFilterCount}</span>}
          </button>
        </div>
        <FilterModal open={bookingFilterOpen} onClose={() => setBookingFilterOpen(false)}>
            <div className="sticky -top-3 z-10 -mx-3 -mt-3 flex items-center justify-between rounded-t-2xl border-b border-slate-700/50 bg-slate-950/95 px-3 py-3 backdrop-blur sm:col-span-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={16} /> فیلترهای بیشتر</div>
              <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-500/15 hover:text-slate-100" onClick={() => setBookingFilterOpen(false)} aria-label="بستن فیلترها">
                <X size={16} />
              </button>
            </div>
            <div className="rounded-xl surface-block p-3">
              <label className="mb-1 block text-xs text-slate-400">از تاریخ</label>
              <input className="input h-10" type="date" value={bookingFilterDraft.from} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, from: e.target.value }))} />
            </div>
            <div className="rounded-xl surface-block p-3">
              <label className="mb-1 block text-xs text-slate-400">تا تاریخ</label>
              <input className="input h-10" type="date" value={bookingFilterDraft.to} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, to: e.target.value }))} />
            </div>
            <div className="rounded-xl surface-block p-3">
              <label className="mb-1 block text-xs text-slate-400">مرتب‌سازی</label>
              <select className="input h-10" value={bookingFilterDraft.sort} onChange={(e) => setBookingFilterDraft((prev) => ({ ...prev, sort: e.target.value as ListFilterState["sort"] }))}>
                <option value="time-asc">زمان (نزدیک‌ترین)</option>
                <option value="time-desc">زمان (دورترین)</option>
                <option value="name-asc">نام برنامه (الف-ی)</option>
                <option value="name-desc">نام برنامه (ی-الف)</option>
              </select>
            </div>
            <div className="rounded-xl surface-block p-3 sm:col-span-2">
              <label className="mb-1 block text-xs text-slate-400">فیلتر برنامه‌ها</label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`rounded-full border px-3 py-1 text-xs transition ${bookingFilterDraft.scheduleIds.length === 0 ? "border-cyan-400 bg-cyan-500/20 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-cyan-500"}`} onClick={() => setBookingFilterDraft((prev) => ({ ...prev, scheduleIds: [] }))}>همه برنامه‌ها</button>
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
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-primary" onClick={() => {
                setBookingFilters(() => bookingFilterDraft);
                setBookingFilterOpen(false);
              }}><Check size={16} /> اعمال فیلتر</button>
              <button type="button" className="btn-ghost" onClick={() => {
                setBookingFilterDraft(() => ({ ...dashboardDefaultListFilters }));
                setBookingFilters(() => ({ ...dashboardDefaultListFilters }));
                setBookingFilterOpen(false);
              }}><RotateCcw size={16} /> ریست</button>
            </div>
        </FilterModal>
      </div>

      <div className="space-y-3">
        {filteredBookings.length === 0 && <div className="text-sm text-slate-400">نتیجه‌ای برای فیلتر انتخابی پیدا نشد.</div>}
        {filteredBookings.map((b) => (
          <div key={b.id} className="rounded-xl surface-block p-3">
            <div className="font-medium break-words">{highlightText(b.schedule.title, bookingFilters.query)}</div>
            <div className="text-sm text-slate-400">نام رزروکننده: {highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر", bookingFilters.query)}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>شماره رزروکننده:</span>
              <span dir="ltr">{highlightText(b.bookedByUser?.phone || "-", bookingFilters.query)}</span>
              {b.bookedByUser?.phone && (
                <button type="button" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-500/10 hover:text-cyan-300" onClick={async () => {
                  await navigator.clipboard.writeText(b.bookedByUser.phone);
                  toast.success("شماره کپی شد");
                }} aria-label="کپی شماره رزروکننده" title="کپی شماره رزروکننده">
                  <Copy size={12} />
                </button>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <UserAvatar src={b.bookedByUser?.avatarUrl} alt="booker avatar" sizeClassName="h-8 w-8" iconSize={14} onClick={() => openAvatarPreview(b.bookedByUser?.avatarUrl, b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر")} />
              <div className="text-xs text-slate-400">{highlightText(b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر مهمان", bookingFilters.query)}</div>
            </div>
            <div className="text-sm text-slate-400">زمان: {b.timeSlot?.startTime ? formatJalaliDateTime(new Date(b.timeSlot.startTime)) : "-"}</div>
            <div className="mt-3 rounded-xl border border-slate-700/50 bg-slate-500/5 p-3">
              <div className="mb-2 text-xs text-slate-400">پاسخ‌های فرم</div>
              {renderAnswers(b.answers, b.schedule?.questions, bookingFilters.query)}
            </div>
            <div className="mt-3">
              <button type="button" className="btn-danger" onClick={() => setCancelTarget(b)} aria-label="کنسل رزرو" title="کنسل رزرو">
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

