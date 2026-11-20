import { handleRoute } from "@/lib/errors";
import { NextRequest } from "next/server";
import {
  adminSmsSettingsGet,
  adminSmsSettingsPatch,
} from "@/services/admin/admin-service";

export async function GET(req: NextRequest) {
  return handleRoute(() => adminSmsSettingsGet(req));
}

export async function PATCH(req: NextRequest) {
  return handleRoute(() => adminSmsSettingsPatch(req));
}
