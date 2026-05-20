import { schedulesCreate } from "@/services/schedules/schedules-service";

export async function POST(req: Request) {
  return schedulesCreate(req);
}
