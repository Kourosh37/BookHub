CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "OtpPurpose" AS ENUM ('AUTH', 'PASSWORD_RESET', 'ACCOUNT_DELETE');

CREATE TYPE "SmsLogType" AS ENUM ('OTP', 'BOOKING_CREATED', 'BOOKING_CANCELED', 'BOOKING_REMINDER', 'GENERIC');

CREATE TYPE "SmsLogStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "username" TEXT,
    "password" TEXT,
    "avatarUrl" TEXT,
    "smsPreferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'AUTH',
    "username" TEXT,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "gapMinutes" INTEGER NOT NULL DEFAULT 10,
    "questions" JSONB NOT NULL,
    "daysConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "timeSlotId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "bookedByUserId" TEXT,
    "visitorName" TEXT,
    "answers" JSONB NOT NULL,
    "bookedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "type" "SmsLogType" NOT NULL,
    "status" "SmsLogStatus" NOT NULL,
    "phone" TEXT,
    "templateId" INTEGER,
    "providerMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SmsGlobalSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bookingCreatedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bookingCanceledEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bookingReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsGlobalSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt" DESC);

CREATE UNIQUE INDEX "Schedule_shareId_key" ON "Schedule"("shareId");

CREATE UNIQUE INDEX "TimeSlot_scheduleId_startTime_key" ON "TimeSlot"("scheduleId", "startTime");

CREATE UNIQUE INDEX "Booking_timeSlotId_key" ON "Booking"("timeSlotId");

ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_bookedByUserId_fkey" FOREIGN KEY ("bookedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
