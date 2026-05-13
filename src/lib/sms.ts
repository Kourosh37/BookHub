type SmsOtpPayload = {
  phone: string;
  code: string;
};

export async function sendOtpSms(_payload: SmsOtpPayload) {
  // TODO: Implement SMS provider integration.
  // Keep this no-op until provider credentials and API are ready.
}
