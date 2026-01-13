-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."StatementType" AS ENUM ('BALANCE_ASSET', 'BALANCE_LIAB', 'INCOME_STATEMENT', 'CASHFLOW');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Period" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LineItem" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "statementType" "public"."StatementType" NOT NULL,
    "parentCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "public"."ImportRun" (
    "id" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ImportError" (
    "id" TEXT NOT NULL,
    "importRunId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rowInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactValue" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "lineItemCode" TEXT NOT NULL,
    "value" DECIMAL(18,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Period_year_key" ON "public"."Period"("year");

-- CreateIndex
CREATE INDEX "FactValue_hospitalId_periodId_idx" ON "public"."FactValue"("hospitalId", "periodId");

-- CreateIndex
CREATE INDEX "FactValue_lineItemCode_idx" ON "public"."FactValue"("lineItemCode");

-- CreateIndex
CREATE UNIQUE INDEX "FactValue_hospitalId_periodId_lineItemCode_version_key" ON "public"."FactValue"("hospitalId", "periodId", "lineItemCode", "version");

-- AddForeignKey
ALTER TABLE "public"."ImportError" ADD CONSTRAINT "ImportError_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "public"."ImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactValue" ADD CONSTRAINT "FactValue_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactValue" ADD CONSTRAINT "FactValue_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;
