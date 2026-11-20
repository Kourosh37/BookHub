import { handleRoute } from "@/lib/errors";
import { scheduleSlots } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  return handleRoute(() => scheduleSlots(req, shareId));
}
