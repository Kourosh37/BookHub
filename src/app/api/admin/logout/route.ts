import { adminLogout } from "@/services/admin/admin-service";

export async function POST(req: Request) {
  return adminLogout(req);
}
