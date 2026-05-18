export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function normalizeOtpCode(value: string) {
  return normalizeDigits(String(value ?? "")).replace(/[^\d]/g, "").trim();
}

export function normalizePhoneInput(value: string) {
  const digits = normalizeDigits(String(value ?? "")).replace(/[^\d]/g, "");

  if (digits.startsWith("09") && digits.length === 11) return digits;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("0098") && digits.length === 14) return `0${digits.slice(4)}`;

  return null;
}

export function normalizeSmsIrMobile(value: string) {
  const normalized = normalizePhoneInput(value);
  if (normalized && normalized.startsWith("0")) return normalized.slice(1);
  const digits = normalizeDigits(String(value ?? "")).replace(/[^\d]/g, "");
  return digits.startsWith("0") ? digits.slice(1) : digits;
}
