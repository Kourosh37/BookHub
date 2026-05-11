import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  password: z.string().min(6),
});

export const questionSchema = z.object({
  label: z.string().min(1),
  type: z.enum(["text", "textarea"]),
  required: z.boolean(),
});

export const dayConfigSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export const scheduleSchema = z.object({
  title: z.string().min(3).max(120),
  daysConfig: z.array(dayConfigSchema).min(1),
  questions: z.array(questionSchema).max(5),
});

export const bookingSchema = z.object({
  timeSlotId: z.string(),
  name: z.string().optional(),
  answers: z.array(z.string()),
});
