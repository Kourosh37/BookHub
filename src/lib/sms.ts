import { normalizeSmsIrMobile } from "@/lib/phone";

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

export type SendTemplateSmsResult = SendOtpSmsResult;

function normalizeMobile(phone: string) {
  return normalizeSmsIrMobile(phone);
}

function parseTemplateId(raw: string | undefined, label: string) {
  if (!raw) throw new Error(`شناسه قالب ${label} تنظیم نشده است`);
  const templateId = Number(raw);
  if (Number.isNaN(templateId)) {
    throw new Error(`شناسه قالب ${label} نامعتبر است`);
  }
  return templateId;
}

async function sendSmsIrTemplate(payload: { phone: string; templateId: number; parameters: Array<{ name: string; value: string }> }) {
  const apiKey = process.env.SMS_API_KEY;
  if (!apiKey) {
    throw new Error("تنظیمات سرویس پیامک ناقص است");
  }

  const body: SmsIrVerifyPayload = {
    mobile: normalizeMobile(payload.phone),
    templateId: payload.templateId,
    parameters: payload.parameters,
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

export async function sendOtpSms(payload: SmsOtpPayload) {
  const apiKey = process.env.SMS_API_KEY;
  const templateIdRaw = process.env.SMS_TEMPLATE_OTP;

  if (!apiKey || !templateIdRaw) {
    throw new Error("تنظیمات سرویس پیامک ناقص است");
  }
  const templateId = parseTemplateId(templateIdRaw, "OTP");

  return sendSmsIrTemplate({
    phone: payload.phone,
    templateId,
    parameters: [
      {
        name: "CODE",
        value: payload.code,
      },
    ],
  });
}

export async function sendTemplateSms(payload: {
  phone: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
}) {
  return sendSmsIrTemplate(payload);
}

export async function sendTextSms(payload: { to: string; text: string }) {
  return {
    ok: true,
    providerMessage: `queued-text:${payload.to}:${payload.text.length}`,
  };
}
