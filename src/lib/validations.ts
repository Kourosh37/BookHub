import { z } from "zod";

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
    .max(30, "نام کاربری نمی‌تواند بیشتر از ۳۰ کاراکتر باشد"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
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
