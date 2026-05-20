import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { CalendarDays, Clock3, Copy, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import toast from "react-hot-toast";

type Props = {
  showCreateFormMobile: boolean;
  setShowCreateFormMobile: (updater: (prev: boolean) => boolean) => void;
  createSchedule: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  createError: string;
  scheduleTitle: string;
  setScheduleTitle: (v: string) => void;
  pickerValue: any;
  selectedDates: string[];
  setSelectedDates: (v: string[]) => void;
  toYmd: (v: any) => string;
  toJalaliLabel: (v: string) => string;
  slotDurationMinutes: number;
  setSlotDurationMinutes: (v: number) => void;
  gapMinutesValue: number;
  setGapMinutesValue: (v: number) => void;
  totalSlotCount: number;
  canCreateSchedule: boolean;
  dayConfigs: any[];
  rangeIssuesByDate: Map<string, Array<string | null>>;
  slotCountByDate: Map<string, number>;
  formatDurationFromMinutesFa: (v: number) => string;
  getRangeLengthMinutes: (v: any) => number;
  updateRange: (date: string, idx: number, field: "startTime" | "endTime", value: string) => void;
  removeRange: (date: string, idx: number) => void;
  addRange: (date: string) => void;
  isInvalidTimeConfig: boolean;
  addQuestion: () => void;
  questions: any[];
  setQuestions: (updater: (prev: any[]) => any[]) => void;
  creatingSchedule: boolean;
  schedules: any[];
  editingScheduleId: string | null;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  saveScheduleTitle: (id: string) => Promise<void>;
  savingTitle: boolean;
  stopEditScheduleTitle: () => void;
  startEditScheduleTitle: (s: any) => void;
  getShareUrl: (shareId: string) => string;
  openQrModal: (s: any) => Promise<void>;
  setDeleteScheduleTarget: (s: any) => void;
};

export function SchedulesSection(props: Props) {
  const {
    showCreateFormMobile,
    setShowCreateFormMobile,
    createSchedule,
    createError,
    scheduleTitle,
    setScheduleTitle,
    pickerValue,
    selectedDates,
    setSelectedDates,
    toYmd,
    toJalaliLabel,
    slotDurationMinutes,
    setSlotDurationMinutes,
    gapMinutesValue,
    setGapMinutesValue,
    totalSlotCount,
    canCreateSchedule,
    dayConfigs,
    rangeIssuesByDate,
    slotCountByDate,
    formatDurationFromMinutesFa,
    getRangeLengthMinutes,
    updateRange,
    removeRange,
    addRange,
    isInvalidTimeConfig,
    addQuestion,
    questions,
    setQuestions,
    creatingSchedule,
    schedules,
    editingScheduleId,
    editingTitle,
    setEditingTitle,
    saveScheduleTitle,
    savingTitle,
    stopEditScheduleTitle,
    startEditScheduleTitle,
    getShareUrl,
    openQrModal,
    setDeleteScheduleTarget,
  } = props;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <h2 className="text-lg font-bold md:text-xl">برنامه‌های من</h2>
        <p className="mt-1 text-sm text-slate-400">برنامه‌های زمانی خود را بسازید، ویرایش کنید و لینک رزرو هر برنامه را مدیریت کنید.</p>
      </div>
      <div className="md:hidden">
        <button type="button" className="btn-primary w-full" onClick={() => setShowCreateFormMobile((prev) => !prev)}>
          <Plus size={16} /> {showCreateFormMobile ? "بستن فرم برنامه جدید" : "برنامه جدید"}
        </button>
      </div>

      <form onSubmit={createSchedule} className={`card space-y-4 p-4 md:p-5 ${showCreateFormMobile ? "block" : "hidden md:block"}`}>
        <h2 className="font-bold">ساخت برنامه جدید</h2>
        {createError && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-200">{createError}</div>}
        <div>
          <label className="mb-2 block text-sm text-slate-300">عنوان برنامه</label>
          <input className="input" name="title" placeholder="مثلاً مشاوره پایان‌نامه" value={scheduleTitle} onChange={(e) => setScheduleTitle(e.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-sm text-slate-300">انتخاب تاریخ‌ها</label>
          <DatePicker
            multiple
            calendar={persian}
            locale={persian_fa}
            value={pickerValue}
            onChange={(v: any) => {
              const arr = Array.isArray(v) ? v : v ? [v] : [];
              const normalized = Array.from(new Set(arr.map((x: any) => toYmd(x)).filter(Boolean)));
              setSelectedDates(normalized);
            }}
            mapDays={({ date }: any) => {
              const ymd = toYmd(date);
              if (selectedDates.includes(ymd)) {
                return { style: { backgroundColor: "rgb(223, 208, 184)", color: "rgb(34, 40, 49)", borderRadius: "10px", fontWeight: "700" } };
              }
              return {};
            }}
            render={(value, openCalendar) => (
              <button type="button" onClick={openCalendar} className="btn-ghost w-full justify-between">
                <span className="flex items-center gap-2"><CalendarDays size={16} /> {selectedDates.length > 0 ? `${selectedDates.length} تاریخ انتخاب شده` : "انتخاب تاریخ"}</span>
                <span className="text-xs text-slate-400">{value || ""}</span>
              </button>
            )}
            calendarPosition="bottom-right"
          />
          {selectedDates.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedDates.map((d) => (
                <span key={d} className="rounded-full border border-cyan-700 bg-cyan-900/30 px-3 py-1 text-xs text-cyan-200">{toJalaliLabel(d)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">مدت هر ارائه (دقیقه)</label>
            <input className="input" name="slotDuration" type="number" min={5} value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(Number(e.target.value) || 0)} required />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">فاصله بین ارائه‌ها (دقیقه)</label>
            <input className="input" name="gapMinutes" type="number" min={0} value={gapMinutesValue} onChange={(e) => setGapMinutesValue(Number(e.target.value) || 0)} required />
          </div>
        </div>

        <div className="space-y-3 rounded-xl surface-block p-3">
          <p className="text-sm text-slate-300">بازه‌های زمانی هر تاریخ</p>
          <p className="text-xs text-slate-400">هر بازه باید حداقل به اندازه مدت جلسه باشد تا اسلات تولید شود.</p>
          <p className="text-xs text-slate-400">فاصله بین ارائه‌ها باید عددی غیرمنفی باشد؛ اگر خیلی بزرگ باشد ممکن است تنها یک اسلات بسازد.</p>
          <p className="text-xs text-slate-400">جمع کل اسلات‌های قابل تولید: {totalSlotCount}</p>
          {totalSlotCount === 0 && <p className="text-xs text-rose-300">هیچ اسلاتی تولید نمی‌شود. بازه‌ها یا مدت جلسه را اصلاح کنید.</p>}
          {totalSlotCount > 0 && totalSlotCount < 3 && <p className="text-xs text-amber-200">اسلات‌های کمی تولید می‌شوند؛ ممکن است نیاز به بازه بیشتر داشته باشید.</p>}
          {!canCreateSchedule && <p className="text-xs text-rose-300">تا زمان اصلاح بازه‌ها امکان ساخت برنامه وجود ندارد.</p>}
          {dayConfigs.map((d) => (
            <div key={d.date} className="rounded-xl surface-block p-3">
              <div className="mb-2 text-sm text-cyan-300">{toJalaliLabel(d.date)}</div>
              {rangeIssuesByDate.get(d.date)?.some(Boolean) && <p className="mb-2 text-xs text-rose-300">حداقل یکی از بازه‌های این تاریخ مشکل دارد.</p>}
              {(slotCountByDate.get(d.date) ?? 0) === 0 && <p className="mb-2 text-xs text-rose-300">برای این تاریخ اسلاتی تولید نمی‌شود.</p>}
              {(slotCountByDate.get(d.date) ?? 0) > 0 && (slotCountByDate.get(d.date) ?? 0) < 2 && <p className="mb-2 text-xs text-amber-200">فقط یک اسلات برای این تاریخ ساخته می‌شود.</p>}
              <div className="space-y-2">
                {d.ranges.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <div className="md:col-span-3 text-xs text-slate-400">
                      طول بازه: {formatDurationFromMinutesFa(getRangeLengthMinutes(r))}
                      {slotDurationMinutes > 0 && getRangeLengthMinutes(r) < slotDurationMinutes && <span className="text-rose-300"> · کوتاه‌تر از مدت جلسه است</span>}
                      {slotDurationMinutes > 0 && getRangeLengthMinutes(r) === slotDurationMinutes && <span className="text-amber-200"> · فقط یک جلسه جا می‌شود</span>}
                      {gapMinutesValue > 0 && getRangeLengthMinutes(r) <= slotDurationMinutes + gapMinutesValue && <span className="text-amber-200"> · فاصله بزرگ است و احتمالاً فقط یک اسلات می‌سازد</span>}
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block text-xs text-slate-400">شروع</label>
                      <input className={`input time-input min-w-0 ${rangeIssuesByDate.get(d.date)?.[i] ? "border-rose-400/70 ring-2 ring-rose-400/30" : ""}`} type="time" value={r.startTime} onChange={(e) => updateRange(d.date, i, "startTime", e.target.value)} />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block text-xs text-slate-400">پایان</label>
                      <input className={`input time-input min-w-0 ${rangeIssuesByDate.get(d.date)?.[i] ? "border-rose-400/70 ring-2 ring-rose-400/30" : ""}`} type="time" value={r.endTime} onChange={(e) => updateRange(d.date, i, "endTime", e.target.value)} />
                    </div>
                    <button type="button" className="btn-ghost w-full md:w-auto md:self-end" onClick={() => removeRange(d.date, i)}><Trash2 size={16} className="icon-danger" /></button>
                    {rangeIssuesByDate.get(d.date)?.[i] && <p className="text-xs text-rose-300 md:col-span-3">{rangeIssuesByDate.get(d.date)?.[i]}</p>}
                  </div>
                ))}
              </div>
              <button type="button" className="btn-ghost mt-2" onClick={() => addRange(d.date)}><Plus size={16} /> افزودن بازه</button>
            </div>
          ))}
          {isInvalidTimeConfig && <p className="text-sm text-rose-300">در بعضی تاریخ‌ها تداخل یا ترتیب نادرست بازه وجود دارد.</p>}
          {createError && !isInvalidTimeConfig && <p className="text-sm text-rose-300">{createError}</p>}
        </div>
        <div className="space-y-2 rounded-xl surface-block p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">سوالات فرم رزرو</p>
            <button type="button" className="btn-ghost" onClick={addQuestion} disabled={questions.length >= 5}><Plus size={16} /> افزودن سوال</button>
          </div>
          {questions.map((q, i) => (
            <div key={i} className="grid gap-2 rounded-lg surface-block p-2">
              <div className="flex justify-end">
                <button type="button" className="btn-ghost" onClick={() => setQuestions((prev) => prev.filter((_, idx) => idx !== i))} aria-label="حذف سوال" title="حذف سوال">
                  <Trash2 size={14} className="icon-danger" />
                  <span>حذف سوال</span>
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">متن سوال</label>
                <input className="input" placeholder={`متن سوال ${i + 1}`} value={q.label} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">نوع پاسخ</label>
                  <select className="input" value={q.type} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, type: e.target.value as "text" | "textarea" } : x)))}>
                    <option value="text">متن کوتاه</option>
                    <option value="textarea">متن بلند</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">الزامی بودن</label>
                  <label className="flex h-11 items-center gap-2 rounded-xl surface-block px-3 text-sm">
                    <input type="checkbox" checked={q.required} onChange={(e) => setQuestions((prev) => prev.map((x, idx) => (idx === i ? { ...x, required: e.target.checked } : x)))} />
                    اجباری
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary w-full" disabled={!canCreateSchedule || creatingSchedule}>
          <Clock3 size={16} /> {creatingSchedule ? "در حال ساخت..." : "ایجاد برنامه"}
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {schedules.map((s) => (
          <div className="card p-4 transition hover:-translate-y-0.5 hover:border-cyan-700" key={s.id}>
            {editingScheduleId === s.id ? (
              <div className="space-y-2">
                <label className="block text-xs text-slate-400">ویرایش نام برنامه</label>
                <input className="input" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} maxLength={120} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-cyan-300" onClick={() => saveScheduleTitle(s.id)} disabled={savingTitle}>{savingTitle ? "در حال ذخیره..." : "ذخیره"}</button>
                  <button type="button" className="btn-ghost" onClick={stopEditScheduleTitle} disabled={savingTitle}>انصراف</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold break-words text-base">{s.title}</h3>
                  <span className="rounded-full border border-cyan-700/60 bg-cyan-900/20 px-2 py-1 text-xs text-cyan-200">برنامه</span>
                </div>
                <p className="text-xs text-slate-500">{s.createdAt ? new Date(s.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" }) : "تاریخ نامشخص"}</p>
              </div>
            )}
            <div className="mt-3 space-y-2 text-sm text-slate-400">
              <a className="block text-cyan-300 break-all" href={getShareUrl(s.shareId)}>{getShareUrl(s.shareId)}</a>
              <div className="flex flex-wrap gap-2">
                {editingScheduleId !== s.id && (
                  <button type="button" className="btn-ghost" onClick={() => startEditScheduleTitle(s)} aria-label="ویرایش نام برنامه" title="ویرایش نام برنامه">
                    <Pencil size={14} />
                    <span className="hidden md:inline">ویرایش نام</span>
                  </button>
                )}
                <button type="button" className="btn-ghost" onClick={async () => {
                  await navigator.clipboard.writeText(getShareUrl(s.shareId));
                  toast.success("لینک کپی شد");
                }} aria-label="کپی لینک برنامه" title="کپی لینک برنامه">
                  <Copy size={14} />
                  <span className="hidden md:inline">کپی لینک</span>
                </button>
                <button type="button" className="btn-ghost" onClick={() => openQrModal(s)} aria-label="نمایش QR برنامه" title="نمایش QR برنامه">
                  <QrCode size={14} />
                  <span className="hidden md:inline">QR برنامه</span>
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDeleteScheduleTarget(s)} aria-label="حذف برنامه" title="حذف برنامه">
                  <Trash2 size={14} className="icon-danger" />
                  <span className="hidden md:inline">حذف برنامه</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
