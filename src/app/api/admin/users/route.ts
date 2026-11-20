import { handleRoute } from "@/lib/errors";
import { NextRequest } from "next/server";
import { adminUsers } from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return handleRoute(() => adminUsers(req));
}
