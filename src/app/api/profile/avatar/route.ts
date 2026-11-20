import { handleRoute } from "@/lib/errors";
import {
  profileAvatarDelete,
  profileAvatarUpload,
} from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return handleRoute(() => profileAvatarUpload(req));
}

export async function DELETE(req: Request) {
  return handleRoute(() => profileAvatarDelete(req));
}
