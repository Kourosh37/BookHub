import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\s|-/g, ""))
  .refine((value) => /^09\d{9}$/.test(value), "شماره موبایل معتبر نیست");

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => /^\d{6}$/.test(value), "کد تایید باید ۶ رقم باشد"),
});

export const questionSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["text", "textarea"]),
  required: z.boolean(),
});

export const timeRangeSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const dayConfigSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ranges: z.array(timeRangeSchema).min(1),
});

export const scheduleSchema = z.object({
  title: z.string().min(3).max(120),
  slotDuration: z.number().min(5).max(180),
  gapMinutes: z.number().min(0).max(120),
  daysConfig: z.array(dayConfigSchema).min(1),
  questions: z.array(questionSchema).max(5),
});

export const updateScheduleTitleSchema = z.object({
  title: z.string().min(3).max(120),
});

export const bookingSchema = z.object({
  timeSlotId: z.string(),
  name: z.string().optional(),
  answers: z.array(z.string()),
});
