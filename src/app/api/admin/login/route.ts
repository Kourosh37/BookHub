import { handleRoute } from "@/lib/errors";
import { adminLogin } from "@/services/admin/admin-service";

export async function POST(req: Request) {
  return handleRoute(() => adminLogin(req));
}
