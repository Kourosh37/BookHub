export type SmsPreferences = {
  bookingCreated: boolean;
  bookingCanceled: boolean;
  bookingReminder: boolean;
};

export type SmsPreferenceKey = keyof SmsPreferences;

export const defaultSmsPreferences: SmsPreferences = {
  bookingCreated: true,
  bookingCanceled: true,
  bookingReminder: true,
};

function coerceSmsPreferences(raw: unknown): Partial<SmsPreferences> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Partial<SmsPreferences>;
}

export function normalizeSmsPreferences(raw?: unknown): SmsPreferences {
  const parsed = coerceSmsPreferences(raw);
  return {
    bookingCreated: typeof parsed?.bookingCreated === "boolean" ? parsed.bookingCreated : true,
    bookingCanceled: typeof parsed?.bookingCanceled === "boolean" ? parsed.bookingCanceled : true,
    bookingReminder: typeof parsed?.bookingReminder === "boolean" ? parsed.bookingReminder : true,
  };
}

export function isSmsEnabled(raw: unknown, key: SmsPreferenceKey) {
  return normalizeSmsPreferences(raw)[key];
}
