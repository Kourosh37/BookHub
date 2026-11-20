import { beforeEach, afterAll, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { prisma } from "@/lib/prisma";
import { resetDatabase, createUser, disconnect } from "../helpers/db";
import { makeSchedule, book } from "../helpers/fixtures";
import { createNotificationQueue } from "@/lib/queue";
beforeEach(resetDatabase);
afterAll(disconnect);
it("the actual worker entry point publishes the outbox and sends through an HTTP provider", async () => {
  const host = await createUser("host", "09111111111"),
    guest = await createUser("guest", "09222222222"),
    schedule = await makeSchedule(host);
  await book(schedule, guest);
  const messages: unknown[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    messages.push(JSON.parse(body));
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        status: 1,
        message: "Sent",
        data: { messageId: messages.length },
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No server address");
  const child = spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      SMS_API_URL: `http://127.0.0.1:${address.port}/send`,
    },
  });
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += String(data);
  });
  try {
    await vi.waitFor(
      async () =>
        expect(
          await prisma.notificationJob.count({
            where: { type: "BOOKING_CREATED", sentAt: { not: null } },
          }),
          errors,
        ).toBe(2),
      { timeout: 15000, interval: 100 },
    );
    expect(messages).toHaveLength(2);
    expect(
      await prisma.notificationJob.count({
        where: { type: "BOOKING_REMINDER", sentAt: null, canceledAt: null },
      }),
    ).toBe(2);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const q = createNotificationQueue();
    try {
      await q.obliterate({ force: true });
    } finally {
      await q.close();
    }
  }
});

it("the recovery CLI retries one failed durable job without touching completed messages", async () => {
  const host = await createUser("host", "09111111111"),
    guest = await createUser("guest", "09222222222"),
    s = await makeSchedule(host);
  await book(s, guest);
  const row = await prisma.notificationJob.findFirstOrThrow({
    where: { type: "BOOKING_CREATED" },
  });
  const q = createNotificationQueue();
  const { Worker } = await import("bullmq");
  const { queueConnection } = await import("@/lib/queue");
  const worker = new Worker(
    "bookhub-notifications",
    async () => {
      throw new Error("injected delivery failure");
    },
    { connection: queueConnection() },
  );
  try {
    await q.add("send", { id: row.id }, { jobId: row.id, attempts: 1 });
    await vi.waitFor(
      async () =>
        expect(await (await q.getJob(row.id))?.getState()).toBe("failed"),
      { timeout: 10000, interval: 50 },
    );
    await worker.close();
    await prisma.notificationJob.update({
      where: { id: row.id },
      data: { attempts: 5, lastError: "failure", publishedAt: new Date() },
    });
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "scripts/retry-notification.ts", row.id],
      { env: process.env, windowsHide: true, timeout: 15000 },
    );
    const updated = await prisma.notificationJob.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.attempts).toBe(0);
    expect(updated.publishedAt).toBeNull();
    expect(updated.lastError).toBeNull();
    expect(await q.getJob(row.id)).toBeUndefined();
  } finally {
    await worker.close();
    await q.obliterate({ force: true });
    await q.close();
  }
});
