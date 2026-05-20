import { schedulesMine } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return schedulesMine();
}
