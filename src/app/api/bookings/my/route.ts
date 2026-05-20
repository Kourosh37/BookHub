import { bookingsMy } from "@/services/bookings/bookings-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return bookingsMy(req);
}
