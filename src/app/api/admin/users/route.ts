import { NextRequest } from "next/server";
import { adminUsers } from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return adminUsers(req);
}
