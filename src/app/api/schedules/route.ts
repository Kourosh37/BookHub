import { handleRoute } from "@/lib/errors";
import { schedulesCreate } from "@/services/schedules/schedules-service";

export async function POST(req: Request) {
  return handleRoute(() => schedulesCreate(req));
}
