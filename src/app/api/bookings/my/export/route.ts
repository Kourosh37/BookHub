import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

function toJalaliDateTime(date: Date) {
  const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return {
    date: dateFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

function csvEscape(value: string) {
  if (value.includes("\"") || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/\"/g, "\"\"")}"`;
  }
  return value;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const scheduleId = url.searchParams.get("scheduleId");

    const bookings = await prisma.booking.findMany({
      where: {
        schedule: {
          userId: session.userId,
        },
        ...(scheduleId ? { scheduleId } : {}),
      },
      include: {
        schedule: {
          select: { title: true },
        },
        timeSlot: true,
        bookedByUser: {
          select: { username: true, phone: true },
        },
      },
      orderBy: { timeSlot: { startTime: "asc" } },
    });

    const header = [
      "عنوان برنامه",
      "نام رزروکننده",
      "شماره رزروکننده",
      "تاریخ",
      "ساعت",
      "پاسخ ها",
    ];

    const rows = bookings.map((b) => {
      const { date, time } = toJalaliDateTime(b.timeSlot.startTime);
      const name = b.bookedByUser?.username || b.bookedByUser?.phone || "کاربر";
      const phone = b.bookedByUser?.phone || "";
      const answers = Array.isArray(b.answers) ? b.answers.join(" | ") : "";
      return [
        b.schedule?.title || "",
        name,
        phone,
        date,
        time,
        answers,
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => csvEscape(String(cell ?? ""))).join(","))
      .join("\n");

    const fileName = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(`\ufeff${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }
}
