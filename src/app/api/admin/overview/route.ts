import { handleRoute } from "@/lib/errors";
import { NextRequest } from "next/server";
import { adminOverview } from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return handleRoute(() => adminOverview(req));
}
