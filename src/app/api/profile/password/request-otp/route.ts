import { handleRoute } from "@/lib/errors";
import { profilePasswordRequestOtp } from "@/services/profile/profile-service";

export async function POST() {
  return handleRoute(() => profilePasswordRequestOtp());
}
