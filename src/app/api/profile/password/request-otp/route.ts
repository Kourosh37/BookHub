import { profilePasswordRequestOtp } from "@/services/profile/profile-service";

export async function POST() {
  return profilePasswordRequestOtp();
}
