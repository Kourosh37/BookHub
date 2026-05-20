import { scheduleUpdateTitle, scheduleDelete } from "@/services/schedules/schedules-service";

export async function PATCH(req: Request, { params }: { params: { scheduleId: string } }) {
  return scheduleUpdateTitle(req, params.scheduleId);
}

export async function DELETE(_req: Request, { params }: { params: { scheduleId: string } }) {
  return scheduleDelete(params.scheduleId);
}
