import { profileSmsPreferencesGet, profileSmsPreferencesPatch } from "@/services/profile/profile-service";

export async function GET() {
  return profileSmsPreferencesGet();
}

export async function PATCH(req: Request) {
  return profileSmsPreferencesPatch(req);
}
