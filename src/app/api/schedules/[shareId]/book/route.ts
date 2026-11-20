import { handleRoute } from "@/lib/errors";
import { scheduleBook } from "@/services/schedules/schedules-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  return handleRoute(() => scheduleBook(req, shareId));
}
