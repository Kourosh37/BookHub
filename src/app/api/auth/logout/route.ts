import { authLogout } from "@/services/auth/auth-service";

export async function POST() {
  return authLogout();
}
