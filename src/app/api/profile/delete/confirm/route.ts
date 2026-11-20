import { handleRoute } from "@/lib/errors";
import { profileDeleteConfirm } from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return handleRoute(() => profileDeleteConfirm(req));
}
