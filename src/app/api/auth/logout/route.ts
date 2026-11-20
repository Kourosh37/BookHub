import { handleRoute } from "@/lib/errors";
import { authLogout } from "@/services/auth/auth-service";

export async function POST() {
  return handleRoute(() => authLogout());
}
