import { handleRoute } from "@/lib/errors";
import { adminLogout } from "@/services/admin/admin-service";

export async function POST(req: Request) {
  return handleRoute(() => adminLogout(req));
}
