import { handleRoute } from "@/lib/errors";
import { scheduleSummary } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  return handleRoute(() => scheduleSummary(shareId));
}
