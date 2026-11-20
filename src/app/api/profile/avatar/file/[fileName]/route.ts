import { handleRoute } from "@/lib/errors";
import { profileAvatarFileGet } from "@/services/profile/profile-service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ fileName: string }> },
) {
  const { fileName } = await params;
  return handleRoute(() => profileAvatarFileGet(fileName));
}
