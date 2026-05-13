type SmsOtpPayload = {
  phone: string;
  code: string;
};

type SmsIrVerifyPayload = {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
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
    return;
  }

  const templateId = Number(templateIdRaw);
  if (Number.isNaN(templateId)) {
    throw new Error("SMS_TEMPLATE_ID is invalid");
  }

  const body: SmsIrVerifyPayload = {
    mobile: normalizeMobile(payload.phone),
    templateId,
    parameters: [
      {
        name: "Code",
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
    throw new Error(`SMS request failed: ${res.status} ${text}`);
  }
}
