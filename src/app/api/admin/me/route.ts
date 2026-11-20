import { handleRoute } from "@/lib/errors";
import { adminMe } from "@/services/admin/admin-service";

export async function GET() {
  return handleRoute(() => adminMe());
}
