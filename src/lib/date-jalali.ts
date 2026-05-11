import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns-jalali";

export const TEHRAN_TZ = "Asia/Tehran";

export function toUtcFromTehranLocal(date: Date) {
  return fromZonedTime(date, TEHRAN_TZ);
}

export function toTehran(date: Date) {
  return toZonedTime(date, TEHRAN_TZ);
}

export function formatJalaliDateTime(date: Date) {
  const tehran = toTehran(date);
  return format(tehran, "yyyy/MM/dd HH:mm");
}

export function formatTime(date: Date) {
  return formatInTimeZone(date, TEHRAN_TZ, "HH:mm");
}

export function persianDigits(value: string | number) {
  const map = ["?", "?", "?", "?", "?", "?", "?", "?", "?", "?"];
  return String(value).replace(/\d/g, (d) => map[Number(d)]);
}
