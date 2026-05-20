import { verifyAuthOtp } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return verifyAuthOtp(req);
}
