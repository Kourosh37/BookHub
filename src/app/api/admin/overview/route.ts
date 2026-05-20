import { NextRequest } from "next/server";
import { adminOverview } from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return adminOverview(req);
}
