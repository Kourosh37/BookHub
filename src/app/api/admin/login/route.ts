import { adminLogin } from "@/services/admin/admin-service";

export async function POST(req: Request) {
  return adminLogin(req);
}
