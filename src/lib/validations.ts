import { z } from "zod";
import { normalizeOtpCode, normalizePhoneInput } from "@/lib/phone";

export const phoneSchema = z
  .string()
  .transform((value) => normalizePhoneInput(value))
  .refine((value) => value !== null, "شماره موبایل معتبر نیست")
  .transform((value) => value as string);

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
  .max(30, "نام کاربری نمی‌تواند بیشتر از ۳۰ کاراکتر باشد");

export const passwordSchema = z
  .string()
  .min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد")
  .max(100, "رمز عبور بیش از حد طولانی است");

export const requestOtpSchema = z
  .object({
    phone: phoneSchema,
    mode: z
      .enum(["login_phone", "register", "password_reset"])
      .default("login_phone"),
    username: usernameSchema.optional(),
    password: passwordSchema.optional(),
    confirmPassword: z.string().max(100).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "register") {
      const u = usernameSchema.safeParse(val.username);
      if (!u.success)
        ctx.addIssue({
          code: "custom",
          path: ["username"],
          message: u.error.issues[0]?.message || "نام کاربری نامعتبر است",
        });

      const p = passwordSchema.safeParse(val.password);
      if (!p.success)
        ctx.addIssue({
          code: "custom",
          path: ["password"],
          message: p.error.issues[0]?.message || "رمز عبور نامعتبر است",
        });

      if (!val.confirmPassword || val.confirmPassword !== val.password) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: "تکرار رمز عبور صحیح نیست",
        });
      }
    }
  });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .transform((value) => normalizeOtpCode(value))
    .refine((value) => /^\d{6}$/.test(value), "کد تایید باید ۶ رقم باشد"),
});

export const passwordLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "نام کاربری یا شماره موبایل را وارد کنید")
    .max(100),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
});

export const updateSmsPreferencesSchema = z.object({
  bookingCreated: z.boolean(),
  bookingCanceled: z.boolean(),
  bookingReminder: z.boolean(),
});

export const updateAdminSmsSettingsSchema = z.object({
  bookingCreatedEnabled: z.boolean(),
  bookingCanceledEnabled: z.boolean(),
  bookingReminderEnabled: z.boolean(),
});

export const changePasswordSchema = z
  .object({
    code: z
      .string()
      .transform((value) => normalizeOtpCode(value))
      .refine((value) => /^\d{6}$/.test(value), "کد تایید باید ۶ رقم باشد"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "تکرار رمز عبور صحیح نیست",
    path: ["confirmPassword"],
  });

export const questionSchema = z.object({
  label: z.string().trim().min(1).max(300),
  type: z.enum(["text", "textarea"]),
  required: z.boolean(),
});

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");
export const timeRangeSchema = z
  .object({ startTime: timeSchema, endTime: timeSchema })
  .refine(
    (range) => range.startTime < range.endTime,
    "End time must be after start time",
  );

export const dayConfigSchema = z.object({
  date: dateSchema,
  ranges: z.array(timeRangeSchema).min(1).max(24),
});

export const scheduleSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slotDuration: z.number().int().min(5).max(180),
  gapMinutes: z.number().int().min(0).max(120),
  daysConfig: z.array(dayConfigSchema).min(1).max(90),
  questions: z.array(questionSchema).max(5),
});

export const updateScheduleTitleSchema = z.object({
  title: z.string().trim().min(3).max(120),
});

export const bookingSchema = z.object({
  timeSlotId: z.string().min(1).max(100),
  name: z.string().trim().max(100).optional(),
  answers: z.array(z.string().trim().max(4000)).max(5),
});
