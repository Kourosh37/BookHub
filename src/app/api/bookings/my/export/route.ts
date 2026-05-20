import { bookingsExport } from "@/services/bookings/bookings-service";

export async function GET(req: Request) {
  return bookingsExport(req);
}
