import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((value) => value.replace(/\s|-/g, ""))
  .refine((value) => /^09\d{9}$/.test(value), "شماره موبایل معتبر نیست");

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
    mode: z.enum(["login_phone", "register", "password_reset"]).default("login_phone"),
    username: z.string().optional(),
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.mode === "register") {
      const u = usernameSchema.safeParse(val.username);
      if (!u.success) ctx.addIssue({ code: "custom", path: ["username"], message: u.error.issues[0]?.message || "نام کاربری نامعتبر است" });

      const p = passwordSchema.safeParse(val.password);
      if (!p.success) ctx.addIssue({ code: "custom", path: ["password"], message: p.error.issues[0]?.message || "رمز عبور نامعتبر است" });

      if (!val.confirmPassword || val.confirmPassword !== val.password) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "تکرار رمز عبور صحیح نیست" });
      }
    }
  });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => /^\d{6}$/.test(value), "کد تایید باید ۶ رقم باشد"),
});

export const passwordLoginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
});

export const changePasswordSchema = z
  .object({
    code: z.string().trim().refine((value) => /^\d{6}$/.test(value), "کد تایید باید ۶ رقم باشد"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "تکرار رمز عبور صحیح نیست",
    path: ["confirmPassword"],
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
