import { scheduleSummary } from "@/services/schedules/schedules-service";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { shareId: string } }) {
  return scheduleSummary(params.shareId);
}
