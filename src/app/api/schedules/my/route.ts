import { handleRoute } from "@/lib/errors";
import { schedulesMine } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(() => schedulesMine());
}
