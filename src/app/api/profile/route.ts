import { profileDeleteMethodNotAllowed, profileGet, profilePatch } from "@/services/profile/profile-service";

export async function GET() {
  return profileGet();
}

export async function PATCH(req: Request) {
  return profilePatch(req);
}

export async function DELETE() {
  return profileDeleteMethodNotAllowed();
}
