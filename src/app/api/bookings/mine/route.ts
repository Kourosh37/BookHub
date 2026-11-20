import { handleRoute } from "@/lib/errors";
import { bookingsMine } from "@/services/bookings/bookings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(() => bookingsMine());
}
