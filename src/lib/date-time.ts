export function formatJalaliDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function formatJalaliTime(date: Date) {
  const formatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(date);
}

export function formatJalaliDateTime(date: Date) {
  return `${formatJalaliDate(date)} ${formatJalaliTime(date)}`;
}

export function minutesUntil(date: Date) {
  return Math.floor((date.getTime() - Date.now()) / 60000);
}

function toFaNumber(value: number) {
  return new Intl.NumberFormat("fa-IR").format(value);
}

export function formatDurationFromMinutesFa(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safeMinutes / (24 * 60));
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
  const minutes = safeMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${toFaNumber(days)} روز`);
  if (hours > 0) parts.push(`${toFaNumber(hours)} ساعت`);
  if (minutes > 0 || parts.length === 0) parts.push(`${toFaNumber(minutes)} دقیقه`);
  return parts.join(" و ");
}
