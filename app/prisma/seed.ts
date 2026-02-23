import bcrypt from "bcrypt";
import { PrismaClient, Role, StatementType, Unit } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function stableSlug(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 32) || "item";
}

function shortHash(input: string) {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 8);
}

function seedCode(prefix: string, label: string) {
  return `${prefix}_${stableSlug(label)}_${shortHash(`${prefix}:${label}`)}`;
}

function parseGermanNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/RICHTIG|DATEN\s+N\.V\./i.test(trimmed)) return null;

  const normalized = trimmed.replace(/\s+/g, "").replace(/%/g, "").replace(/\./g, "").replace(/,/g, ".");

  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

function guessStatementTypeFromHeading(line: string): StatementType | null {
  if (/^1;B\s*I\s*L\s*A\s*N\s*Z/i.test(line) && /A\s*K\s*T\s*I\s*V\s*A/i.test(line)) {
    return StatementType.BALANCE_ASSET;
  }
  if (/^2;B\s*I\s*L\s*A\s*N\s*Z/i.test(line) && /P\s*A\s*S\s*S\s*I\s*V\s*A/i.test(line)) {
    return StatementType.BALANCE_LIAB;
  }
  if (/^3;G\s*E\s*W\s*I\s*N\s*N/i.test(line) && /\(\s*U\s*K\s*V\s*\)/i.test(line)) {
    return StatementType.INCOME_STATEMENT_UKV;
  }
  if (/^4;G\s*E\s*W\s*I\s*N\s*N/i.test(line) && /\(\s*G\s*K\s*V\s*\)/i.test(line)) {
    return StatementType.INCOME_STATEMENT_GKV;
  }
  return null;
}

function prefixForStatementType(st: StatementType) {
  switch (st) {
    case StatementType.BALANCE_ASSET:
      return "BAL_A";
    case StatementType.BALANCE_LIAB:
      return "BAL_P";
    case StatementType.INCOME_STATEMENT_UKV:
      return "UKV";
    case StatementType.INCOME_STATEMENT_GKV:
      return "GKV";
    case StatementType.CASHFLOW:
      return "CF";
    default:
      return "ST";
  }
}

function statementTitle(st: StatementType) {
  switch (st) {
    case StatementType.BALANCE_ASSET:
      return "Bilanz – Aktiva";
    case StatementType.BALANCE_LIAB:
      return "Bilanz – Passiva";
    case StatementType.INCOME_STATEMENT_UKV:
      return "GuV (UKV)";
    case StatementType.INCOME_STATEMENT_GKV:
      return "GuV (GKV)";
    case StatementType.CASHFLOW:
      return "Cashflow";
    default:
      return String(st);
  }
}

function guessLevel(label: string, labelColumnIndex: number) {
  const t = label.trim();
  if (/^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\./.test(t)) return 1;
  if (/^[A-Z]\./.test(t)) return 0;
  if (/^\d+\./.test(t)) return 2;
  if (/^davon\b/i.test(t)) return 3;
  if (labelColumnIndex >= 2) return 3;
  return 2;
}

function guessUnit(label: string, values: string[]) {
  if (values.some((v) => v.includes("%"))) return Unit.PERCENT;
  if (/Anzahl|Mitarbeiter/i.test(label)) return Unit.COUNT;
  return Unit.EUR;
}

function guessIsInput(marker: string, label: string) {
  if (marker.trim() === "=") return false;
  if (/Verprobung/i.test(label)) return false;
  return true;
}

async function seedFromCsv() {
  const csvPath = path.join(process.cwd(), "prisma", "data", "mabila_eingabe_stadtwerke_delmenhorst.csv");
  const content = await readFile(csvPath, "utf8");
  const lines = content.split(/\r?\n/);
  if (lines.length < 2) return;

  const headerCols = lines[0].split(";");
  const years = headerCols
    .slice(3)
    .map((y) => Number(String(y).trim()))
    .filter((y) => Number.isInteger(y));

  for (const year of years) {
    await prisma.period.upsert({
      where: { year },
      update: {},
      create: { year },
    });
  }

  const sampleName = "Stadtwerke Delmenhorst (Sample)";
  const existing = await prisma.hospital.findFirst({ where: { name: sampleName } });
  const hospital =
    existing ??
    (await prisma.hospital.create({
      data: {
        name: sampleName,
        city: "Delmenhorst",
        state: "Niedersachsen",
      },
    }));

  const periodByYear = new Map<number, { id: string }>();
  const periods = await prisma.period.findMany({ where: { year: { in: years } } });
  for (const p of periods) periodByYear.set(p.year, { id: p.id });

  let currentStatementType: StatementType | null = null;
  let sortOrder = 0;
  const stack: Array<string | null> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headingType = guessStatementTypeFromHeading(trimmed);
    if (headingType) {
      currentStatementType = headingType;
      sortOrder = 0;
      stack.length = 0;

      const cols = trimmed.split(";");
      const label = String(cols[1] ?? "").trim() || String(cols[2] ?? "").trim();
      const valueCells = cols.slice(3);
      const hasValues = valueCells.some((v) => {
        const parsed = parseGermanNumber(String(v ?? "").trim());
        return parsed !== null;
      });

      if (hasValues && /B\s*I\s*L\s*A\s*N\s*Z/i.test(label)) {
        const prefix = prefixForStatementType(currentStatementType);
        const code = `${prefix}_0000_total_${shortHash(label)}`;
        const totalLabel = `${statementTitle(currentStatementType)} (Summe)`;

        await prisma.lineItem.upsert({
          where: { code },
          update: {
            label: totalLabel,
            statementType: currentStatementType,
            parentCode: null,
            sortOrder: 0,
            unit: Unit.EUR,
            isInput: false,
          },
          create: {
            code,
            label: totalLabel,
            statementType: currentStatementType,
            parentCode: null,
            sortOrder: 0,
            unit: Unit.EUR,
            isInput: false,
          },
        });

        for (let i = 0; i < years.length; i += 1) {
          const year = years[i];
          const raw = String(valueCells[i] ?? "").trim();
          const parsed = parseGermanNumber(raw);
          if (parsed === null) continue;
          const period = periodByYear.get(year);
          if (!period) continue;
          await prisma.factValue.upsert({
            where: {
              hospitalId_periodId_lineItemCode: {
                hospitalId: hospital.id,
                periodId: period.id,
                lineItemCode: code,
              },
            },
            update: { value: parsed },
            create: {
              hospitalId: hospital.id,
              periodId: period.id,
              lineItemCode: code,
              value: parsed,
            },
          });
        }
      }

      continue;
    }

    if (!currentStatementType) continue;
    if (/^E\s*I\s*N\s*G\s*A\s*B\s*E\s*T\s*E\s*I\s*L/i.test(trimmed)) continue;
    if (/Verprobung/i.test(trimmed)) continue;

    const cols = trimmed.split(";");
    const c0 = String(cols[0] ?? "");
    const c1 = String(cols[1] ?? "");
    const c2 = String(cols[2] ?? "");

    const marker = c0.trim();

    let labelColumnIndex = 1;
    let label = c1.trim();
    if (c2.trim()) {
      labelColumnIndex = 2;
      label = c2.trim();
    } else if (!label && marker && !/^\d+$/.test(marker)) {
      labelColumnIndex = 1;
      label = c1.trim();
    }

    if (!label) continue;

    if (/B\s*I\s*L\s*A\s*N\s*Z\s*\s*:/i.test(label)) continue;

    const valueCells = cols.slice(3);
    if (valueCells.length === 0) continue;

    const unit = guessUnit(label, valueCells);
    const isInput = guessIsInput(marker, label);
    const level = guessLevel(label, labelColumnIndex);

    sortOrder += 1;
    const prefix = prefixForStatementType(currentStatementType);
    const parentCode = level > 0 ? (stack[level - 1] ?? null) : null;

    const existingLineItem = await prisma.lineItem.findFirst({
      where: {
        statementType: currentStatementType,
        label,
        parentCode,
      },
      select: { code: true },
    });

    const code = existingLineItem?.code ?? seedCode(prefix, label);

    await prisma.lineItem.upsert({
      where: { code },
      update: {
        label,
        statementType: currentStatementType,
        parentCode,
        sortOrder,
        unit,
        isInput,
      },
      create: {
        code,
        label,
        statementType: currentStatementType,
        parentCode,
        sortOrder,
        unit,
        isInput,
      },
    });

    stack[level] = code;
    stack.length = Math.max(stack.length, level + 1);

    for (let i = 0; i < years.length; i += 1) {
      const year = years[i];
      const raw = String(valueCells[i] ?? "").trim();
      const parsed = parseGermanNumber(raw);

      if (year === 2020 && raw === "0,0") continue;
      if (parsed === null) continue;

      const period = periodByYear.get(year);
      if (!period) continue;

      await prisma.factValue.upsert({
        where: {
          hospitalId_periodId_lineItemCode: {
            hospitalId: hospital.id,
            periodId: period.id,
            lineItemCode: code,
          },
        },
        update: { value: parsed },
        create: {
          hospitalId: hospital.id,
          periodId: period.id,
          lineItemCode: code,
          value: parsed,
        },
      });
    }
  }

  console.log("Seeded CSV sample hospital:", { id: hospital.id, name: hospital.name, years });
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
  if (!isProd || seedSampleData) {
    await seedFromCsv();
  } else {
    console.warn("[seed] Skipping sample CSV data in production. Set SEED_SAMPLE_DATA=true to enable.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
