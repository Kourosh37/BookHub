import { describe, expect, it } from "vitest";
import { hashOtp } from "@/lib/otp";
import { phoneSchema } from "@/lib/validations";

describe("otp utilities", () => {
  it("hashOtp is deterministic for same input", () => {
    const a = hashOtp("09113709021", "123456");
    const b = hashOtp("09113709021", "123456");
    expect(a).toBe(b);
  });

  it("phone schema normalizes accepted formats", () => {
    expect(phoneSchema.parse("+98 9113709021")).toBe("09113709021");
    expect(phoneSchema.parse("9113709021")).toBe("09113709021");
    expect(phoneSchema.parse("09113709021")).toBe("09113709021");
  });
});

