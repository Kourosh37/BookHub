import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import gregorian from "react-date-object/calendars/gregorian";
import persian_fa from "react-date-object/locales/persian_fa";
import type { ReactNode } from "react";
import type { ListFilterState } from "@/features/dashboard/store/dashboard-page-store";
import type { Range } from "@/features/dashboard/types/dashboard";

export function toEnglishDigits(value: string) {
  return value
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

export function toPersianDigits(value: string) {
  return value.replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

export function formatPhoneForExport(value: any) {
  const normalized = toEnglishDigits(String(value ?? "").trim());
  if (!normalized || normalized === "-") return "-";
  return toPersianDigits(normalized);
}

export function toYmd(dateObj: any) {
  if (!dateObj) return "";
  return toEnglishDigits(new DateObject(dateObj).convert(gregorian).format("YYYY-MM-DD"));
}

export function ymdToPersianDateObject(ymd: string) {
  return new DateObject({
    date: ymd,
    format: "YYYY-MM-DD",
    calendar: gregorian,
    locale: persian_fa,
  }).convert(persian, persian_fa);
}

export function toJalaliLabel(ymd: string) {
  if (!ymd) return "";
  try {
    return new DateObject({
      date: ymd,
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: persian_fa,
    })
      .convert(persian, persian_fa)
      .format("D MMMM YYYY");
  } catch {
    return ymd;
  }
}

export function toMinutes(v: string) {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export function normalizeSearchText(value: any) {
  return toEnglishDigits(String(value ?? "")).toLowerCase().trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(value: any, query: string) {
  const text = String(value ?? "");
  const rawQuery = query.trim();
  if (!rawQuery) return text;
  const regex = new RegExp(escapeRegExp(rawQuery), "gi");
  const parts = text.split(regex);
  const matches = text.match(regex);
  if (!matches) return text;
  return (
    <>
      {parts.map((part, idx) => (
        <span key={`${part}-${idx}`}>
          {part}
          {matches[idx] ? (
            <mark className="rounded bg-cyan-500/30 px-1 text-cyan-100">{matches[idx]}</mark>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function getRangeLengthMinutes(range: Range) {
  const start = toMinutes(range.startTime);
  const end = toMinutes(range.endTime);
  return end - start;
}

export function renderAnswers(
  answers: any,
  questions: any,
  query: string,
  highlighter: (value: any, query: string) => ReactNode,
) {
  const items =
    Array.isArray(questions) && questions.length > 0
      ? questions.map((q: any, idx: number) => ({
          label: q?.label || `سوال ${idx + 1}`,
          value: Array.isArray(answers) ? answers[idx] : "-",
        }))
      : Array.isArray(answers)
        ? answers.map((value: any, idx: number) => ({ label: `پاسخ ${idx + 1}`, value }))
        : [];

  if (items.length === 0) {
    return <div className="text-xs text-slate-400">پاسخی ثبت نشده است.</div>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-wrap items-start justify-between gap-2 text-sm">
          <span className="text-slate-300">{highlighter(item.label, query)}</span>
          <span className="rounded-lg bg-slate-500/10 px-2 py-1 text-xs text-slate-300">
            {item.value ? highlighter(String(item.value), query) : "-"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function estimateSlotCount(range: Range, slotDuration: number, gapMinutes: number) {
  if (slotDuration <= 0) return 0;
  const length = getRangeLengthMinutes(range);
  if (length < slotDuration) return 0;
  const step = slotDuration + Math.max(0, gapMinutes);
  return Math.max(1, Math.floor((length - slotDuration) / step) + 1);
}

export function rangesOverlap(ranges: Range[]) {
  const sorted = [...ranges]
    .map((r) => ({ ...r, s: toMinutes(r.startTime), e: toMinutes(r.endTime) }))
    .sort((a, b) => a.s - b.s);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].e <= sorted[i].s) return true;
    if (i > 0 && sorted[i].s < sorted[i - 1].e) return true;
  }
  return false;
}

export function getRangeIssues(ranges: Range[]) {
  const issues: Array<string | null> = Array.from({ length: ranges.length }, () => null);
  const sorted = ranges
    .map((r, idx) => ({ ...r, idx, s: toMinutes(r.startTime), e: toMinutes(r.endTime) }))
    .sort((a, b) => a.s - b.s);

  for (const item of sorted) {
    if (item.e <= item.s) {
      issues[item.idx] = "زمان پایان باید بعد از زمان شروع باشد.";
    }
  }

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.s < prev.e) {
      issues[cur.idx] = issues[cur.idx] || "این بازه با بازه قبلی همپوشانی دارد.";
      issues[prev.idx] = issues[prev.idx] || "این بازه با بازه بعدی همپوشانی دارد.";
    }
  }

  return issues;
}

export function normalizePreviewUrl(src?: string | null) {
  if (!src) return "";
  if (src.startsWith("/")) return src;
  try {
    const url = new URL(src);
    if (url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/api/profile/avatar")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {}
  return src;
}

function parseDateInput(value: string, endOfDay = false) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

export function applyListFilters(list: any[], filters: ListFilterState, queryMatch: (item: any, query: string) => boolean) {
  const now = Date.now();
  const fromDate = parseDateInput(filters.from);
  const toDate = parseDateInput(filters.to, true);
  const query = normalizeSearchText(filters.query);

  return list.filter((item) => {
    const start = item?.timeSlot?.startTime ? new Date(item.timeSlot.startTime).getTime() : null;
    if (filters.scheduleIds.length > 0 && !filters.scheduleIds.includes(item?.scheduleId)) return false;
    const end = item?.timeSlot?.endTime || item?.timeSlot?.startTime;
    if (end && new Date(end).getTime() < now) return false;
    if (fromDate && start !== null && start < fromDate.getTime()) return false;
    if (toDate && start !== null && start > toDate.getTime()) return false;
    if (query && !queryMatch(item, query)) return false;
    return true;
  });
}


