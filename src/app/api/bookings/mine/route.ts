import { bookingsMine } from "@/services/bookings/bookings-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return bookingsMine();
}
