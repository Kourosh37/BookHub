import { profileAvatarFileGet } from "@/services/profile/profile-service";

export async function GET(_: Request, { params }: { params: { fileName: string } }) {
  return profileAvatarFileGet(params.fileName);
}
