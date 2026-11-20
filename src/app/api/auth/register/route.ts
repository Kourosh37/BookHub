import { handleRoute } from "@/lib/errors";
import { requestOtp } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return handleRoute(() => requestOtp(req));
}
