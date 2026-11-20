import { handleRoute } from "@/lib/errors";
import {
  profileSmsPreferencesGet,
  profileSmsPreferencesPatch,
} from "@/services/profile/profile-service";

export async function GET() {
  return handleRoute(() => profileSmsPreferencesGet());
}

export async function PATCH(req: Request) {
  return handleRoute(() => profileSmsPreferencesPatch(req));
}
