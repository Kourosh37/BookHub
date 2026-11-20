import { handleRoute } from "@/lib/errors";
import { passwordLogin } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return handleRoute(() => passwordLogin(req));
}
