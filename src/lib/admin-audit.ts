import { AdminAuditAction } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAdminAuditLog(input: {
  adminUser: string;
  action: AdminAuditAction;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUser: input.adminUser,
        action: input.action,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        metadata: (input.metadata || null) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
      },
    });
  } catch {
    // best-effort logging
  }
}
