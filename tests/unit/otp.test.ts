import { describe, expect, it } from "vitest";
import { hashOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/validations";

describe("ابزارهای OTP", () => {
  it("hashOtp برای ورودی یکسان باید خروجی یکسان بدهد", () => {
    const a = hashOtp("09113709021", "123456");
    const b = hashOtp("09113709021", "123456");
    expect(a).toBe(b);
  });

  it("phone schema باید فرمت‌های معتبر را نرمال‌سازی کند", () => {
    expect(phoneSchema.parse("+98 9113709021")).toBe("09113709021");
    expect(phoneSchema.parse("9113709021")).toBe("09113709021");
    expect(phoneSchema.parse("09113709021")).toBe("09113709021");
  });
});
