import { NextRequest } from "next/server";
import { adminSmsSettingsGet, adminSmsSettingsPatch } from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return adminSmsSettingsGet(req);
}

export async function PATCH(req: NextRequest) {
  return adminSmsSettingsPatch(req);
}
