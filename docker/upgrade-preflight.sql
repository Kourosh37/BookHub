-- Validate the legacy database before baselining or applying the new migration.
BEGIN READ ONLY;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public._prisma_migrations
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
  ) THEN
    RAISE EXCEPTION 'An unfinished migration requires investigation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."Booking"
    WHERE "bookedByUserId" IS NOT NULL
    GROUP BY "scheduleId", "bookedByUserId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate guest/schedule reservations require investigation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."Schedule"
    WHERE "slotDuration" NOT BETWEEN 5 AND 180
       OR "gapMinutes" NOT BETWEEN 0 AND 120
  ) THEN
    RAISE EXCEPTION 'Invalid schedule duration or gap requires investigation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public."TimeSlot" WHERE "endTime" <= "startTime"
  ) THEN
    RAISE EXCEPTION 'Invalid slot range requires investigation';
  END IF;
END;
$$;
COMMIT;
