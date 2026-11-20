export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function normalizeOtpCode(value: string) {
  return normalizeDigits(String(value ?? ""))
    .replace(/[\s-]/g, "")
    .trim();
}

export function normalizePhoneInput(value: string) {
  const normalized = normalizeDigits(String(value ?? ""));
  if (/[^+\d\s()-]/.test(normalized)) return null;
  const digits = normalized.replace(/[^\d]/g, "");
  let phone = digits;
  if (digits.startsWith("0098")) phone = `0${digits.slice(4)}`;
  else if (digits.startsWith("98")) phone = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) phone = `0${digits}`;
  return /^09\d{9}$/.test(phone) ? phone : null;
}

export function normalizeSmsIrMobile(value: string) {
  const normalized = normalizePhoneInput(value);
  if (normalized && normalized.startsWith("0")) return normalized.slice(1);
  const digits = normalizeDigits(String(value ?? "")).replace(/[^\d]/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}
