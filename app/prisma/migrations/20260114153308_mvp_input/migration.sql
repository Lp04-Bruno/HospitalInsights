-- CreateEnum
CREATE TYPE "public"."Unit" AS ENUM ('EUR', 'PERCENT', 'COUNT');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."StatementType_new" AS ENUM ('BALANCE_ASSET', 'BALANCE_LIAB', 'INCOME_STATEMENT_UKV', 'INCOME_STATEMENT_GKV', 'CASHFLOW');
ALTER TABLE "public"."LineItem" ALTER COLUMN "statementType" TYPE "public"."StatementType_new" USING ("statementType"::text::"public"."StatementType_new");
ALTER TYPE "public"."StatementType" RENAME TO "StatementType_old";
ALTER TYPE "public"."StatementType_new" RENAME TO "StatementType";
DROP TYPE "public"."StatementType_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."FactValue_hospitalId_periodId_lineItemCode_version_key";

-- AlterTable
ALTER TABLE "public"."FactValue" DROP COLUMN "version",
ALTER COLUMN "value" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."LineItem" ADD COLUMN     "isInput" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "unit" "public"."Unit" NOT NULL DEFAULT 'EUR';

-- CreateIndex
CREATE UNIQUE INDEX "FactValue_hospitalId_periodId_lineItemCode_key" ON "public"."FactValue"("hospitalId", "periodId", "lineItemCode");

