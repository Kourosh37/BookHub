import { adminLogout } from "@/services/admin/admin-service";

export async function POST() {
  return adminLogout();
}
