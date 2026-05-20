import { profilePasswordConfirm } from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return profilePasswordConfirm(req);
}
