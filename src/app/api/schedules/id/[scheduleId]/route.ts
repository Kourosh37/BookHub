import { handleRoute } from "@/lib/errors";
import {
  scheduleUpdateTitle,
  scheduleDelete,
} from "@/services/schedules/schedules-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await params;
  return handleRoute(() => scheduleUpdateTitle(req, scheduleId));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ scheduleId: string }> },
) {
  const { scheduleId } = await params;
  return handleRoute(() => scheduleDelete(scheduleId));
}
