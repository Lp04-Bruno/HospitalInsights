"use server";

import { redirect } from "next/navigation";

import { EDITOR_ROLES, requireAnyRole } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { parseStatementTab } from "@/lib/facts/loadStatementContext";
import { formString, yearSchema } from "@/lib/validation";

export async function createPeriod(formData: FormData) {
  await requireAnyRole(EDITOR_ROLES, "/dashboard/data");

  const year = yearSchema.safeParse(formData.get("year"));
  const hospitalId = formString(formData, "hospitalId");
  const statementType = formString(formData, "statementType");

  if (!hospitalId) redirect("/dashboard/data");

  if (!year.success) {
    redirect(`/dashboard/data?hospitalId=${encodeURIComponent(hospitalId)}`);
  }

  const period = await prisma.period.upsert({
    where: { year: year.data },
    update: {},
    create: { year: year.data },
    select: { id: true, year: true },
  });

  await prisma.hospitalPeriod.upsert({
    where: { hospitalId_periodId: { hospitalId, periodId: period.id } },
    update: {},
    create: { hospitalId, periodId: period.id },
  });

  const qs = new URLSearchParams();
  qs.set("hospitalId", hospitalId);
  qs.set("year", String(year.data));
  if (parseStatementTab(statementType)) qs.set("statementType", statementType);

  redirect(`/dashboard/data?${qs.toString()}`);
}
