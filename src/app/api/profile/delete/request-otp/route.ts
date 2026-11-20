import { handleRoute } from "@/lib/errors";
import { profileDeleteRequestOtp } from "@/services/profile/profile-service";

export async function POST() {
  return handleRoute(() => profileDeleteRequestOtp());
}
