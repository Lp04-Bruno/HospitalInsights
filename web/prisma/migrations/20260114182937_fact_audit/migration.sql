-- CreateEnum
CREATE TYPE "public"."FactChangeRunKind" AS ENUM ('SAVE', 'UNDO');

-- CreateTable
CREATE TABLE "public"."FactChangeRun" (
    "id" TEXT NOT NULL,
    "kind" "public"."FactChangeRunKind" NOT NULL DEFAULT 'SAVE',
    "hospitalId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "statementType" "public"."StatementType" NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactChangeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactChange" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "statementType" "public"."StatementType" NOT NULL,
    "lineItemCode" TEXT NOT NULL,
    "unit" "public"."Unit" NOT NULL,
    "beforeValue" DECIMAL(18,2),
    "afterValue" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactChangeRun_hospitalId_periodId_statementType_createdAt_idx" ON "public"."FactChangeRun"("hospitalId", "periodId", "statementType", "createdAt");

-- CreateIndex
CREATE INDEX "FactChange_runId_idx" ON "public"."FactChange"("runId");

-- CreateIndex
CREATE INDEX "FactChange_hospitalId_periodId_statementType_lineItemCode_idx" ON "public"."FactChange"("hospitalId", "periodId", "statementType", "lineItemCode");

-- AddForeignKey
ALTER TABLE "public"."FactChangeRun" ADD CONSTRAINT "FactChangeRun_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactChangeRun" ADD CONSTRAINT "FactChangeRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactChangeRun" ADD CONSTRAINT "FactChangeRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactChange" ADD CONSTRAINT "FactChange_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."FactChangeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
