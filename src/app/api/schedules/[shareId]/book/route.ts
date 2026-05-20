import { scheduleBook } from "@/services/schedules/schedules-service";

export async function POST(req: Request, { params }: { params: { shareId: string } }) {
  return scheduleBook(req, params.shareId);
}
