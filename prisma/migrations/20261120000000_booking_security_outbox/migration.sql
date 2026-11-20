-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELED');

-- DropIndex
DROP INDEX "Booking_timeSlotId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED';

-- CreateTable
CREATE TABLE "AdminSession" (
    "tokenHash" TEXT NOT NULL,
    "adminUser" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "SmsLogType" NOT NULL,
    "bookingId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_key_key" ON "NotificationJob"("key");

-- CreateIndex
CREATE INDEX "NotificationJob_sentAt_canceledAt_publishedAt_runAt_idx" ON "NotificationJob"("sentAt", "canceledAt", "publishedAt", "runAt");

-- CreateIndex
CREATE INDEX "NotificationJob_bookingId_idx" ON "NotificationJob"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_timeSlotId_status_idx" ON "Booking"("timeSlotId", "status");


-- Enforce active reservations while allowing canceled history and later rebooking.
CREATE UNIQUE INDEX "Booking_active_slot_key" ON "Booking"("timeSlotId") WHERE "status" = 'CONFIRMED';
CREATE UNIQUE INDEX "Booking_active_guest_schedule_key" ON "Booking"("scheduleId", "bookedByUserId") WHERE "status" = 'CONFIRMED' AND "bookedByUserId" IS NOT NULL;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_duration_check" CHECK ("slotDuration" BETWEEN 5 AND 180 AND "gapMinutes" BETWEEN 0 AND 120);
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_range_check" CHECK ("endTime" > "startTime");
