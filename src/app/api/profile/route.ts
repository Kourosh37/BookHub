import { handleRoute } from "@/lib/errors";
import {
  profileDeleteMethodNotAllowed,
  profileGet,
  profilePatch,
} from "@/services/profile/profile-service";

export async function GET() {
  return handleRoute(() => profileGet());
}

export async function PATCH(req: Request) {
  return handleRoute(() => profilePatch(req));
}

export async function DELETE() {
  return handleRoute(() => profileDeleteMethodNotAllowed());
}
