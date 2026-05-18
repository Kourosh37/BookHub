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

export function normalizeSmsPreferences(raw?: Partial<SmsPreferences> | null): SmsPreferences {
  return {
    bookingCreated: typeof raw?.bookingCreated === "boolean" ? raw.bookingCreated : true,
    bookingCanceled: typeof raw?.bookingCanceled === "boolean" ? raw.bookingCanceled : true,
    bookingReminder: typeof raw?.bookingReminder === "boolean" ? raw.bookingReminder : true,
  };
}

export function isSmsEnabled(raw: Partial<SmsPreferences> | null | undefined, key: SmsPreferenceKey) {
  return normalizeSmsPreferences(raw)[key];
}
