import { z } from "zod";
export const userViewSchema = z.object({
  id: z.string(),
  phone: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
const question = z.object({
  label: z.string(),
  type: z.enum(["text", "textarea"]),
  required: z.boolean(),
});
export const scheduleViewSchema = z.object({
  id: z.string(),
  shareId: z.string(),
  title: z.string(),
  userId: z.string(),
  slotDuration: z.number(),
  gapMinutes: z.number(),
  questions: z.array(question),
  daysConfig: z.array(
    z.object({
      date: z.string(),
      ranges: z.array(z.object({ startTime: z.string(), endTime: z.string() })),
    }),
  ),
  createdAt: z.string(),
});
export const bookingViewSchema = z.object({
  id: z.string(),
  scheduleId: z.string(),
  timeSlotId: z.string(),
  bookedByUserId: z.string().nullable(),
  visitorName: z.string().nullable(),
  answers: z.array(z.string()),
  bookedAt: z.string(),
  status: z.enum(["CONFIRMED", "CANCELED"]),
  canceledAt: z.string().nullable(),
  timeSlot: z.object({
    id: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    isBooked: z.boolean(),
  }),
  schedule: scheduleViewSchema.extend({ user: userViewSchema }),
  bookedByUser: userViewSchema.nullable().optional(),
});
export type ScheduleView = z.infer<typeof scheduleViewSchema>;
export type BookingView = z.infer<typeof bookingViewSchema>;
export type UserView = z.infer<typeof userViewSchema>;
