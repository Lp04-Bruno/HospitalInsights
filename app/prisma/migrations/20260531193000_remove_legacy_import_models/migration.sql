-- Remove unused CSV import tracking tables. Seed/demo data is no longer shipped
-- as CSV; demo datasets can be imported through the backup/restore workflow.
DROP TABLE IF EXISTS "public"."ImportError";
DROP TABLE IF EXISTS "public"."ImportRun";
