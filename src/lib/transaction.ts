import { Prisma } from "@prisma/client";

export async function lockUsers(
  tx: Prisma.TransactionClient,
  userIds: string[],
) {
  for (const id of [...new Set(userIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`user:${id}`}, 0))`;
  }
}
