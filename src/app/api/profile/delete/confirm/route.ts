import { profileDeleteConfirm } from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return profileDeleteConfirm(req);
}
