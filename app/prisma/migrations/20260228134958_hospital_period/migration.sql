-- CreateTable
CREATE TABLE "public"."HospitalPeriod" (
    "hospitalId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalPeriod_pkey" PRIMARY KEY ("hospitalId","periodId")
);

-- CreateIndex
CREATE INDEX "HospitalPeriod_periodId_idx" ON "public"."HospitalPeriod"("periodId");

-- AddForeignKey
ALTER TABLE "public"."HospitalPeriod" ADD CONSTRAINT "HospitalPeriod_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "public"."Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HospitalPeriod" ADD CONSTRAINT "HospitalPeriod_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "public"."Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing hospital/year associations from existing data.
INSERT INTO "public"."HospitalPeriod" ("hospitalId", "periodId")
SELECT DISTINCT "hospitalId", "periodId" FROM "public"."FactValue"
ON CONFLICT DO NOTHING;

INSERT INTO "public"."HospitalPeriod" ("hospitalId", "periodId")
SELECT DISTINCT "hospitalId", "periodId" FROM "public"."FactChangeRun"
ON CONFLICT DO NOTHING;
