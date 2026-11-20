import { handleRoute } from "@/lib/errors";
import { cancelBooking } from "@/services/bookings/bookings-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  return handleRoute(() => cancelBooking(req, bookingId));
}
