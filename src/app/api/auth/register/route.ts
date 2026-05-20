import { requestOtp } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return requestOtp(req);
}
