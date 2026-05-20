import { scheduleSlots } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { shareId: string } }) {
  return scheduleSlots(req, params.shareId);
}
