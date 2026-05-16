type SmsOtpPayload = {
  phone: string;
  code: string;
};

type SmsIrVerifyPayload = {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
};

type SmsIrVerifyResponse = {
  status: number;
  message: string;
  data?: {
    messageId?: number;
    cost?: number;
  };
};

export type SendOtpSmsResult = {
  ok: boolean;
  providerMessage: string;
  messageId?: number;
  cost?: number;
};

function normalizeMobile(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("09") && digits.length === 11) return digits.slice(1);
  if (digits.startsWith("9") && digits.length === 10) return digits;
  return digits;
}

export async function sendOtpSms(payload: SmsOtpPayload) {
  const apiKey = process.env.SMS_API_KEY;
  const templateIdRaw = process.env.SMS_TEMPLATE_ID;

  if (!apiKey || !templateIdRaw) {
    throw new Error("تنظیمات سرویس پیامک ناقص است");
  }

  const templateId = Number(templateIdRaw);
  if (Number.isNaN(templateId)) {
    throw new Error("شناسه قالب پیامک نامعتبر است");
  }

  const body: SmsIrVerifyPayload = {
    mobile: normalizeMobile(payload.phone),
    templateId,
    parameters: [
      {
        name: "OTP",
        value: payload.code,
      },
    ],
  };

  const res = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ارسال پیامک ناموفق بود: ${res.status} ${text}`);
  }

  const responseJson = (await res.json()) as SmsIrVerifyResponse;
  if (responseJson.status !== 1) {
    throw new Error(`سرویس پیامک درخواست را رد کرد: ${responseJson.message || "خطای نامشخص"}`);
  }

  return {
    ok: true,
    providerMessage: responseJson.message,
    messageId: responseJson.data?.messageId,
    cost: responseJson.data?.cost,
  } satisfies SendOtpSmsResult;
}

export async function sendTextSms(payload: { to: string; text: string }) {
  return {
    ok: true,
    providerMessage: `queued-text:${payload.to}:${payload.text.length}`,
  };
}
