import { cancelBooking } from "@/services/bookings/bookings-service";

export async function POST(req: Request, { params }: { params: { bookingId: string } }) {
  return cancelBooking(req, params.bookingId);
}
