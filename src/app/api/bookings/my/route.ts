import { handleRoute } from "@/lib/errors";
import { bookingsMy } from "@/services/bookings/bookings-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleRoute(() => bookingsMy(req));
}
