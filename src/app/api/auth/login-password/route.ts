import { passwordLogin } from "@/services/auth/auth-service";

export async function POST(req: Request) {
  return passwordLogin(req);
}
