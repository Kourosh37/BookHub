import { handleRoute } from "@/lib/errors";
import { profilePasswordConfirm } from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return handleRoute(() => profilePasswordConfirm(req));
}
