import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "عدم دسترسی" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") || 50), 1), 200);
  const query = (searchParams.get("q") || "").trim();

  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { username: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const [total, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        phone: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
  });
}
