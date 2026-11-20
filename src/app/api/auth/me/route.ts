import { handleRoute } from "@/lib/errors";
import { authMe } from "@/services/auth/auth-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(() => authMe());
}
