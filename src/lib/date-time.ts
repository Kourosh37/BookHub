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
