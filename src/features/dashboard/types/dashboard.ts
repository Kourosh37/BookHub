export type Question = { label: string; type: "text" | "textarea"; required: boolean };
export type Range = { startTime: string; endTime: string };
export type DayItem = { date: string; ranges: Range[] };
export type ProfileSectionKey = "username" | "avatar" | "password" | "delete";
export type SettingsSectionKey = "sms";
export type QrModalState = { schedule: any; url: string };

