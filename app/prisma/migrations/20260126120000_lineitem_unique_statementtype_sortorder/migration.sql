-- Add uniqueness to prevent duplicate LineItem sets per statement type.

ALTER TABLE "LineItem"
ADD CONSTRAINT "LineItem_statementType_sortOrder_key"
UNIQUE ("statementType", "sortOrder");
