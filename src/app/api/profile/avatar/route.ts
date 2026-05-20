import { profileAvatarDelete, profileAvatarUpload } from "@/services/profile/profile-service";

export async function POST(req: Request) {
  return profileAvatarUpload(req);
}

export async function DELETE(req: Request) {
  return profileAvatarDelete(req);
}
