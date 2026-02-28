import bcrypt from "bcrypt";
import { PrismaClient, Role, StatementType, Unit } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getStatementCatalog } from "../lib/statementCatalog";

const prisma = new PrismaClient();

function parseGermanNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/RICHTIG|DATEN\s+N\.V\./i.test(trimmed)) return null;

  const normalized = trimmed.replace(/\s+/g, "").replace(/%/g, "").replace(/\./g, "").replace(/,/g, ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function normalizeForMatch(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/grundst\.?/g, "grundstueck")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function guessStatementTypeFromHeading(line: string): StatementType | null {
  const normalized = line.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  if (normalized.startsWith("1BILANZAKTIVA")) return StatementType.BALANCE_ASSET;
  if (normalized.startsWith("2BILANZPASSIVA")) return StatementType.BALANCE_LIAB;
  if (normalized.startsWith("3GEWINNUNDVERLUSTRECHNUNGUKV")) return StatementType.INCOME_STATEMENT_UKV;
  if (normalized.startsWith("4GEWINNUNDVERLUSTRECHNUNGGKV")) return StatementType.INCOME_STATEMENT_GKV;

  return null;
}

function guessLevel(label: string): number {
  const t = label.trim();
  if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\./.test(t)) return 1;
  if (/^[A-Z]\./.test(t)) return 0;
  if (/^\d+\./.test(t)) return 2;
  if (/^davon\b/i.test(t)) return 3;
  return 2;
}

function isSpecialOtherRow(label: string): boolean {
  const t = label.toLowerCase();
  return t.includes("steuersatz") || t.includes("vollzeit") || t.includes("mitarbeiter");
}

async function seedFromCatalogAndCsv() {
  const { lineItems } = getStatementCatalog();

  const csvPath = path.join(process.cwd(), "prisma", "data", "mabila_eingabe_stadtwerke_delmenhorst.csv");
  const csv = await readFile(csvPath, "utf8");
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const headerCols = (lines[0] ?? "").split(";");
  const years = headerCols
    .slice(3)
    .map((y) => Number(String(y).trim()))
    .filter((y) => Number.isInteger(y));

  if (years.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      await prisma.period.deleteMany({ where: { year: { notIn: years } } });
    }
    for (const year of years) {
      await prisma.period.upsert({ where: { year }, update: {}, create: { year } });
    }
  }

  const canonicalSampleName = "Stadtwerke Delmenhorst";
  const sampleNames = [canonicalSampleName, `${canonicalSampleName} (Sample)`];
  const existingSamples = await prisma.hospital.findMany({ where: { name: { in: sampleNames } }, select: { id: true, name: true } });
  const keep = existingSamples.find((h) => h.name === canonicalSampleName) ?? existingSamples[0];

  let sampleHospitalId: string;
  if (!keep) {
    const created = await prisma.hospital.create({
      data: { name: canonicalSampleName, city: "Delmenhorst", state: "Niedersachsen" },
      select: { id: true },
    });
    sampleHospitalId = created.id;
  } else {
    sampleHospitalId = keep.id;
    await prisma.hospital.update({
      where: { id: sampleHospitalId },
      data: { name: canonicalSampleName, city: "Delmenhorst", state: "Niedersachsen" },
    });
    await prisma.hospital.deleteMany({ where: { id: { in: existingSamples.map((h) => h.id).filter((id) => id !== sampleHospitalId) } } });
  }

  const periodByYear = new Map<number, { id: string }>();
  if (years.length > 0) {
    const periods = await prisma.period.findMany({ where: { year: { in: years } }, select: { id: true, year: true } });
    for (const p of periods) periodByYear.set(p.year, { id: p.id });
  }

  type LI = { code: string; label: string; statementType: StatementType; parentCode: string | null; unit: Unit };
  const topParentByStatement = new Map<StatementType, string | null>();
  for (const st of Object.values(StatementType)) {
    const roots = lineItems.filter((li) => li.statementType === st && li.parentCode === null);
    topParentByStatement.set(st, roots.length === 1 ? roots[0]!.code : null);
  }

  const candidatesByParent = new Map<string, LI[]>();
  const tokenCache = new Map<string, Set<string>>();
  for (const li of lineItems) {
    const k = `${li.statementType}::${li.parentCode ?? ""}`;
    const arr = candidatesByParent.get(k) ?? [];
    arr.push({ code: li.code, label: li.label, statementType: li.statementType, parentCode: li.parentCode, unit: li.unit });
    candidatesByParent.set(k, arr);
    tokenCache.set(li.code, new Set(normalizeForMatch(li.label).split(" ").filter(Boolean)));
  }

  function bestMatch(statementType: StatementType, parentCode: string | null, csvLabel: string): LI | null {
    const parentKey = `${statementType}::${parentCode ?? ""}`;
    const candidates = candidatesByParent.get(parentKey) ?? [];
    if (candidates.length === 0) return null;

    const norm = normalizeForMatch(csvLabel);
    const targetTokens = new Set(norm.split(" ").filter(Boolean));
    if (targetTokens.size === 0) return null;

    let best: LI | null = null;
    let bestScore = 0;

    for (const c of candidates) {
      const ct = tokenCache.get(c.code) ?? new Set<string>();
      let score = jaccard(targetTokens, ct);

      const mA = /^\s*(\d+\.|[A-Z]\.|(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.)/.exec(csvLabel);
      const mB = /^\s*(\d+\.|[A-Z]\.|(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\.)/.exec(c.label);
      if (mA?.[1] && mB?.[1] && mA[1] === mB[1]) score += 0.15;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return bestScore >= 0.45 ? best : null;
  }

  let currentStatementType: StatementType | null = null;
  const stack: Array<string | null> = [null, null, null, null];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingType = guessStatementTypeFromHeading(trimmed);
    if (headingType) {
      currentStatementType = headingType;
      stack.fill(null);
      continue;
    }

    if (!currentStatementType) continue;
    if (/^E\s*I\s*N\s*G\s*A\s*B\s*E\s*T\s*E\s*I\s*L/i.test(trimmed)) continue;
    if (/Verprobung/i.test(trimmed)) continue;

    const cols = trimmed.split(";");
    const c1 = String(cols[1] ?? "");
    const c2 = String(cols[2] ?? "");

    const label = (c2.trim() ? c2 : c1).trim();
    if (!label) continue;

    if (isSpecialOtherRow(label)) {
      const topParent = topParentByStatement.get(StatementType.CASHFLOW) ?? null;
      const candidate = bestMatch(StatementType.CASHFLOW, topParent, label);
      if (!candidate) continue;

      const valueCells = cols.slice(3);
      for (let i = 0; i < years.length; i += 1) {
        const year = years[i];
        const period = periodByYear.get(year);
        if (!period) continue;

        const raw = String(valueCells[i] ?? "");
        const parsed = parseGermanNumber(raw);
        if (parsed === null) continue;

        await prisma.factValue.upsert({
          where: {
            hospitalId_periodId_lineItemCode: {
              hospitalId: sampleHospitalId,
              periodId: period.id,
              lineItemCode: candidate.code,
            },
          },
          update: { value: parsed },
          create: { hospitalId: sampleHospitalId, periodId: period.id, lineItemCode: candidate.code, value: parsed },
        });
      }
      continue;
    }

    const level = guessLevel(label);
    const topParent = topParentByStatement.get(currentStatementType) ?? null;
    const parentCode = level === 0 ? topParent : (stack[level - 1] ?? topParent);

    const matched = bestMatch(currentStatementType, parentCode, label);
    if (!matched) continue;

    stack[level] = matched.code;
    for (let d = level + 1; d < stack.length; d += 1) stack[d] = null;

    const valueCells = cols.slice(3);
    for (let i = 0; i < years.length; i += 1) {
      const year = years[i];
      const period = periodByYear.get(year);
      if (!period) continue;

      const raw = String(valueCells[i] ?? "");
      const parsed = parseGermanNumber(raw);
      if (parsed === null) continue;

      await prisma.factValue.upsert({
        where: {
          hospitalId_periodId_lineItemCode: {
            hospitalId: sampleHospitalId,
            periodId: period.id,
            lineItemCode: matched.code,
          },
        },
        update: { value: parsed },
        create: { hospitalId: sampleHospitalId, periodId: period.id, lineItemCode: matched.code, value: parsed },
      });
    }
  }

  console.log("Seeded catalog + CSV sample:", { lineItems: lineItems.length, years, sampleHospitalId });
}

async function ensureCatalogLineItems(opts: { reset: boolean }) {
  const { lineItems } = getStatementCatalog();

  if (opts.reset) {
    await prisma.factChange.deleteMany({});
    await prisma.factChangeRun.deleteMany({});
    await prisma.factValue.deleteMany({});
    await prisma.lineItem.deleteMany({});
  }

  const existingCount = await prisma.lineItem.count();
  if (existingCount === 0) {
    await prisma.lineItem.createMany({ data: lineItems });
    console.log("Seeded catalog line items:", { lineItems: lineItems.length });
  } else {
    console.log("Catalog line items already present:", { lineItems: existingCount });
  }
}

async function main() {
  const isProd = process.env.NODE_ENV === "production";

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL ?? (isProd ? "" : "admin@hospitalinsights.local");
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProd ? "" : "admin1234");

  if (!isProd || (seedAdminEmail && seedAdminPassword)) {
    if (!seedAdminEmail || !seedAdminPassword) {
      throw new Error("Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD for admin seeding");
    }

    const hash = await bcrypt.hash(seedAdminPassword, 12);
    await prisma.user.upsert({
      where: { email: seedAdminEmail },
      update: {
        name: "Admin",
        password: hash,
        role: Role.ADMIN,
      },
      create: {
        email: seedAdminEmail,
        name: "Admin",
        password: hash,
        role: Role.ADMIN,
      },
    });

    console.log("Seeded admin:", { email: seedAdminEmail });
    if (!isProd) {
      console.log("[dev] Seeded admin password is the default unless SEED_ADMIN_PASSWORD is set.");
    }
  } else {
    console.warn(
      "[seed] Skipping admin creation in production. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD if you want to seed an admin user."
    );
  }

  const seedSampleData = process.env.SEED_SAMPLE_DATA === "true";

  await ensureCatalogLineItems({ reset: !isProd });

  if (!isProd || seedSampleData) {
    await seedFromCatalogAndCsv();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
