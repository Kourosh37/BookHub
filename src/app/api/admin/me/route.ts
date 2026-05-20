import { adminMe } from "@/services/admin/admin-service";

export async function GET() {
  return adminMe();
}
