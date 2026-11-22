-- Run before starting the new app or worker. No row data is printed.
-- Exclude only the new columns so legacy data can be compared across migration.
SELECT 'User' AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg((to_jsonb(t) - 'sessionVersion')::text, E'\n' ORDER BY t.id), '')) AS checksum
FROM public."User" t
UNION ALL
SELECT 'Schedule', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."Schedule" t
UNION ALL
SELECT 'TimeSlot', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."TimeSlot" t
UNION ALL
SELECT 'Booking', count(*),
       md5(coalesce(string_agg((to_jsonb(t) - 'status' - 'canceledAt')::text, E'\n' ORDER BY t.id), ''))
FROM public."Booking" t
UNION ALL
SELECT 'OtpCode', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."OtpCode" t
UNION ALL
SELECT 'SmsLog', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."SmsLog" t
UNION ALL
SELECT 'SmsGlobalSetting', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."SmsGlobalSetting" t
UNION ALL
SELECT 'OtpAttempt', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."OtpAttempt" t
UNION ALL
SELECT 'AdminAuditLog', count(*),
       md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.id), ''))
FROM public."AdminAuditLog" t
ORDER BY table_name;
