import { handleRoute } from "@/lib/errors";
import { verifyAuthOtp } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return handleRoute(() => verifyAuthOtp(req));
}
