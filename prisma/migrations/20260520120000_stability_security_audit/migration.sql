-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'VIEW_OVERVIEW', 'VIEW_USERS', 'VIEW_SMS_SETTINGS', 'UPDATE_SMS_SETTINGS');

-- CreateTable
CREATE TABLE "OtpAttempt" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUser" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Schedule_userId_createdAt_idx" ON "Schedule"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TimeSlot_scheduleId_startTime_isBooked_idx" ON "TimeSlot"("scheduleId", "startTime", "isBooked");

-- CreateIndex
CREATE INDEX "TimeSlot_endTime_idx" ON "TimeSlot"("endTime");

-- CreateIndex
CREATE INDEX "Booking_scheduleId_bookedAt_idx" ON "Booking"("scheduleId", "bookedAt" DESC);

-- CreateIndex
CREATE INDEX "Booking_bookedByUserId_bookedAt_idx" ON "Booking"("bookedByUserId", "bookedAt" DESC);

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "SmsLog_type_status_createdAt_idx" ON "SmsLog"("type", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OtpAttempt_phone_purpose_key" ON "OtpAttempt"("phone", "purpose");

-- CreateIndex
CREATE INDEX "OtpAttempt_lockedUntil_idx" ON "OtpAttempt"("lockedUntil");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUser_createdAt_idx" ON "AdminAuditLog"("adminUser", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt" DESC);
