-- Remove run kind / undo support. All FactChangeRun rows represent saves.

ALTER TABLE "FactChangeRun" DROP COLUMN IF EXISTS "kind";

DROP TYPE IF EXISTS "FactChangeRunKind";
