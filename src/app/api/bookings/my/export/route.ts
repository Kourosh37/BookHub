import { handleRoute } from "@/lib/errors";
import { bookingsExport } from "@/services/bookings/bookings-service";

export async function GET(req: Request) {
  return handleRoute(() => bookingsExport(req));
}
