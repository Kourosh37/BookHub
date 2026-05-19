import { prisma } from "@/lib/prisma";

export type SmsGlobalSettings = {
  bookingCreatedEnabled: boolean;
  bookingCanceledEnabled: boolean;
  bookingReminderEnabled: boolean;
};

export async function getSmsGlobalSettings() {
  return prisma.smsGlobalSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function updateSmsGlobalSettings(next: SmsGlobalSettings) {
  return prisma.smsGlobalSetting.upsert({
    where: { id: 1 },
    update: next,
    create: { id: 1, ...next },
  });
}
