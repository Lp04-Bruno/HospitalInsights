import { StatementType, Unit } from "../prisma/generated/enums";

type FormulaRef = {
  code: string;
  weight: number;
};

type CatalogNode = {
  key: string;
  label: string;
  unit?: Unit;
  isInput?: boolean;
  formulaKeys?: Array<{ key: string; weight: number }>;
  children?: CatalogNode[];
};

export type CatalogLineItem = {
  code: string;
  label: string;
  statementType: StatementType;
  parentCode: string | null;
  sortOrder: number;
  unit: Unit;
  isInput: boolean;
};

export type CatalogFormulaByCode = Map<string, FormulaRef[]>;

function normalizeKeySegment(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function codeFor(prefix: string, keyPath: string[]): string {
  const parts = keyPath.map(normalizeKeySegment).filter(Boolean);
  return [prefix, ...parts].join("__");
}

function buildStatement(opts: { prefix: string; statementType: StatementType; nodes: CatalogNode[] }): {
  lineItems: CatalogLineItem[];
  formulasByCode: CatalogFormulaByCode;
} {
  const { prefix, statementType, nodes } = opts;

  const keyToCode = new Map<string, string>();
  const items: CatalogLineItem[] = [];
  const formulasByCode: CatalogFormulaByCode = new Map();
  let sortOrder = 0;

  function walk(parent: { code: string | null; keyPath: string[] }, node: CatalogNode) {
    sortOrder += 1;
    const keyPath = [...parent.keyPath, node.key];
    const code = codeFor(prefix, keyPath);
    if (keyToCode.has(node.key)) {
      throw new Error(`Duplicate catalog key within statement ${statementType}: ${node.key}`);
    }
    keyToCode.set(node.key, code);

    items.push({
      code,
      label: node.label,
      statementType,
      parentCode: parent.code,
      sortOrder,
      unit: node.unit ?? Unit.EUR,
      isInput: node.isInput ?? true,
    });

    for (const child of node.children ?? []) {
      walk({ code, keyPath }, child);
    }
  }

  for (const n of nodes) {
    walk({ code: null, keyPath: [] }, n);
  }

  for (const n of nodes) {
    const stack: CatalogNode[] = [n];
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.formulaKeys?.length) {
        const code = keyToCode.get(cur.key);
        if (!code) throw new Error(`Missing code for formula node: ${cur.key}`);
        const refs: FormulaRef[] = cur.formulaKeys.map((r) => {
          const refCode = keyToCode.get(r.key);
          if (!refCode) throw new Error(`Formula reference not found: ${cur.key} -> ${r.key}`);
          return { code: refCode, weight: r.weight };
        });
        formulasByCode.set(code, refs);
      }

      for (const c of cur.children ?? []) stack.push(c);
    }
  }

  return { lineItems: items, formulasByCode };
}

function mergeFormulaMaps(...maps: CatalogFormulaByCode[]): CatalogFormulaByCode {
  const out: CatalogFormulaByCode = new Map();
  for (const m of maps) {
    for (const [k, v] of m.entries()) out.set(k, v);
  }
  return out;
}

export function getStatementCatalog(): { lineItems: CatalogLineItem[]; formulasByCode: CatalogFormulaByCode } {
  const balanceAsset = buildStatement({
    prefix: "BAL_A",
    statementType: StatementType.BALANCE_ASSET,
    nodes: [
      {
        key: "TOTAL",
        label: "Bilanz: Aktiva",
        isInput: false,
        children: [
          {
            key: "A",
            label: "A. Anlagevermögen",
            isInput: true,
            children: [
              {
                key: "A_I",
                label: "I. Immaterielle Vermögenswerte",
                isInput: true,
                children: [
                  { key: "A_I_1", label: "1. Selbst geschaffene gewerbliche Schutzrechte und ähnliche Rechte und Werte" },
                  { key: "A_I_2", label: "2. Entgeltlich erworbene Konzessionen, gewerbliche Schutzrechte und ähnliche Rechte und Werte" },
                  { key: "A_I_3", label: "3. Geschäfts- und Firmenwert" },
                  { key: "A_I_4", label: "4. Geleistete Anzahlungen" },
                ],
              },
              {
                key: "A_II",
                label: "II. Sachanlagen",
                isInput: true,
                children: [
                  {
                    key: "A_II_1",
                    label: "1. Grundstücke, grundstücksgleiche Rechte und Bauten einschließlich der Bauten auf fremden Grundstücken",
                  },
                  { key: "A_II_2", label: "2. Technische Anlagen und Maschinen" },
                  { key: "A_II_3", label: "3. Andere Anlagen, Betriebs- und Geschäftsausstattung" },
                  { key: "A_II_4", label: "4. Geleistete Anzahlungen und Anlagen im Bau" },
                ],
              },
              {
                key: "A_III",
                label: "III. Finanzanlagen",
                isInput: true,
                children: [
                  { key: "A_III_1", label: "1. Anteile an verbundenen Unternehmen" },
                  { key: "A_III_2", label: "2. Ausleihungen an verbundene Unternehmen" },
                  { key: "A_III_3", label: "3. Beteiligungen" },
                  { key: "A_III_4", label: "4. Ausleihungen an Unternehmen, mit denen ein Beteiligungsverhältnis besteht" },
                  { key: "A_III_5", label: "5. Wertpapiere des Anlagevermögens" },
                  { key: "A_III_6", label: "6. Sonstige Ausleihungen und Finanzanlagen" },
                ],
              },
            ],
          },
          {
            key: "B",
            label: "B. Umlaufvermögen",
            isInput: true,
            children: [
              {
                key: "B_1",
                label: "I. Vorräte",
                isInput: true,
                children: [
                  { key: "B_1_1", label: "1. Roh-, Hilfs- und Betriebsstoffe" },
                  { key: "B_1_2", label: "2. Unfertige Erzeugnisse und Leistungen" },
                  { key: "B_1_3", label: "3. Fertige Erzeugnisse und Waren" },
                  { key: "B_1_4", label: "4. Geleistete Anzahlungen" },
                ],
              },
              {
                key: "B_2",
                label: "II. Forderungen und sonstige Vermögenswerte",
                isInput: true,
                children: [
                  { key: "B_2_1", label: "1. Forderungen aus Lieferungen und Leistungen" },
                  { key: "B_2_2", label: "2. Forderungen gegen verbundene Unternehmen" },
                  { key: "B_2_3", label: "3. Forderungen gegen Unternehmen, mit denen ein Beteiligungsverhältnis besteht" },
                  { key: "B_2_4", label: "4. Sonstige Vermögenswerte" },
                ],
              },
              {
                key: "B_3",
                label: "III. Wertpapiere",
                isInput: true,
                children: [
                  { key: "B_3_1", label: "1. Anteile an verbundenen Unternehmen" },
                  { key: "B_3_2", label: "2. Sonstige Wertpapiere" },
                ],
              },
              { key: "B_4", label: "IV. Kassenbestand, Guthaben bei Kreditinstituten" },
            ],
          },
          { key: "C", label: "C. Rechnungsabgrenzungsposten" },
          { key: "D", label: "D. Aktive latente Steuern" },
          { key: "E", label: "E. Aktiver Unterschiedsbetrag aus der Vermögensverrechnung" },
        ],
      },
    ],
  });

  const balanceLiab = buildStatement({
    prefix: "BAL_P",
    statementType: StatementType.BALANCE_LIAB,
    nodes: [
      {
        key: "TOTAL",
        label: "Bilanz: Passiva",
        isInput: false,
        children: [
          {
            key: "A",
            label: "A. Eigenkapital",
            isInput: true,
            children: [
              { key: "A_I", label: "I. Gezeichnetes Kapital" },
              { key: "A_II", label: "II. Kapitalrücklage" },
              { key: "A_III", label: "III. Gewinnrücklagen" },
              { key: "A_IV", label: "IV. Gewinnvortrag/Verlustvortrag" },
              { key: "A_V", label: "V. Jahresüberschuss/Jahresfehlbetrag" },
            ],
          },
          { key: "B", label: "B. Sonderposten", isInput: true },
          {
            key: "C",
            label: "C. Rückstellungen",
            isInput: true,
            children: [
              { key: "C_1", label: "1. Rückstellungen für Pensionen und ähnliche Verpflichtungen" },
              { key: "C_2", label: "2. Steuerrückstellungen" },
              { key: "C_3", label: "3. Sonstige Rückstellungen" },
            ],
          },
          {
            key: "D",
            label: "D. Verbindlichkeiten",
            isInput: true,
            children: [
              {
                key: "D_1",
                label: "1. Anleihen, davon konvertibel",
                children: [{ key: "D_1_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_2",
                label: "2. Verbindlichkeiten gegenüber Kreditinstituten",
                children: [{ key: "D_2_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_3",
                label: "3. Erhaltene Anzahlungen",
                children: [{ key: "D_3_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_4",
                label: "4. Verbindlichkeiten aus Lieferungen und Leistungen",
                children: [{ key: "D_4_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_5",
                label: "5. Verbindlichkeiten aus der Annahme gezogener Wechsel und der Ausstellung eigener Wechsel",
                children: [{ key: "D_5_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_6",
                label: "6. Verbindlichkeiten gegenüber verbundenen Unternehmen",
                children: [{ key: "D_6_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_7",
                label: "7. Verbindlichkeiten gegenüber Gesellschaftern",
                children: [{ key: "D_7_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_8",
                label: "8. Verbindlichkeiten gegenüber Unternehmen, mit denen ein Beteiligungsverhältnis besteht",
                children: [{ key: "D_8_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
              {
                key: "D_9",
                label: "9. Sonstige Verbindlichkeiten",
                children: [{ key: "D_9_DAVON", label: "davon mit einer RLZ < 1 Jahr" }],
              },
            ],
          },
          { key: "E", label: "E. Rechnungsabgrenzungsposten" },
          { key: "F", label: "F. Passive latente Steuern" },
        ],
      },
    ],
  });

  const ukv = buildStatement({
    prefix: "UKV",
    statementType: StatementType.INCOME_STATEMENT_UKV,
    nodes: [
      {
        key: "UMSATZ",
        label: "Umsatzerlöse",
        isInput: true,
      },
      { key: "HKS", label: "Herstellungskosten", isInput: true },
      {
        key: "BRUTTO",
        label: "Bruttoergebnis",
        isInput: false,
        formulaKeys: [
          { key: "UMSATZ", weight: 1 },
          { key: "HKS", weight: -1 },
        ],
      },
      { key: "SBE", label: "Sonstige betriebliche Erträge", isInput: true },
      {
        key: "ROH",
        label: "Rohergebnis",
        isInput: false,
        formulaKeys: [
          { key: "BRUTTO", weight: 1 },
          { key: "SBE", weight: 1 },
        ],
      },
      {
        key: "VVK",
        label: "Vertriebs- und Verwaltungskosten",
        isInput: true,
        formulaKeys: [
          { key: "VVK_V", weight: 1 },
          { key: "VVK_A", weight: 1 },
        ],
        children: [
          { key: "VVK_V", label: "davon Vertriebskosten" },
          { key: "VVK_A", label: "davon allgemeine Verwaltungskosten" },
        ],
      },
      { key: "FEK", label: "Forschungs- und Entwicklungskosten", isInput: true },
      { key: "SBA", label: "Sonstige betriebliche Aufwendungen", isInput: true },
      {
        key: "BETR",
        label: "Betriebsergebnis",
        isInput: false,
        formulaKeys: [
          { key: "ROH", weight: 1 },
          { key: "VVK", weight: -1 },
          { key: "FEK", weight: -1 },
          { key: "SBA", weight: -1 },
        ],
      },
      { key: "BETEIL", label: "Beteiligungsergebnis", isInput: true },
      { key: "ZINS_E", label: "Zinsen und ähnliche Erträge", isInput: true },
      { key: "ZINS_A", label: "Zinsen und ähnliche Aufwendungen", isInput: true },
      { key: "UEBR_FIN", label: "Übriges Finanzergebnis", isInput: true },
      {
        key: "FIN",
        label: "Finanzergebnis",
        isInput: false,
        formulaKeys: [
          { key: "BETEIL", weight: 1 },
          { key: "ZINS_E", weight: 1 },
          { key: "ZINS_A", weight: -1 },
          { key: "UEBR_FIN", weight: 1 },
        ],
      },
      {
        key: "STEUERN",
        label: "Steuern vom Einkommen und Ertrag",
        isInput: true,
        formulaKeys: [
          { key: "STEUERN_LAT", weight: 1 },
          { key: "STEUERN_LAUF", weight: 1 },
        ],
        children: [
          { key: "STEUERN_LAT", label: "davon latente Steuern" },
          { key: "STEUERN_LAUF", label: "davon laufende Steuern" },
        ],
      },
      { key: "SONST_ST", label: "Sonstige Steuern", isInput: true },
      {
        key: "JUE",
        label: "Jahresüberschuss/Jahresfehlbetrag",
        isInput: false,
        formulaKeys: [
          { key: "BETR", weight: 1 },
          { key: "FIN", weight: 1 },
          { key: "STEUERN", weight: -1 },
          { key: "SONST_ST", weight: -1 },
        ],
      },

      {
        key: "MAT",
        label: "Angaben zum Materialaufwand:",
        isInput: false,
        children: [
          { key: "MAT_RHB", label: "davon Aufwendungen für Roh-, Hilfs- und Betriebsstoffe" },
          { key: "MAT_BL", label: "davon Aufwendungen für bezogene Leistungen" },
        ],
      },
      {
        key: "PER",
        label: "Angaben zum Personalaufwand:",
        isInput: false,
        children: [
          { key: "PER_LG", label: "davon Löhne und Gehälter" },
          { key: "PER_SA", label: "davon soziale Abgaben und Aufwendungen für Unterstützung" },
        ],
      },
      { key: "ABSCH", label: "Abschreibungen auf Anlagevermögen", isInput: true },
    ],
  });

  const gkv = buildStatement({
    prefix: "GKV",
    statementType: StatementType.INCOME_STATEMENT_GKV,
    nodes: [
      {
        key: "UMSATZ",
        label: "Umsatzerlöse",
        isInput: true,
      },

      { key: "BESTAND", label: "Bestandsveränderung fertige und unfertige Erzeugnisse" },
      { key: "EIGEN", label: "Andere aktivierte Eigenleistungen" },
      {
        key: "GESAMT",
        label: "Gesamtleistung",
        isInput: false,
        formulaKeys: [
          { key: "UMSATZ", weight: 1 },
          { key: "BESTAND", weight: 1 },
          { key: "EIGEN", weight: 1 },
        ],
      },
      { key: "SBE", label: "Sonstige betriebliche Erträge" },
      {
        key: "MAT",
        label: "Materialaufwand",
        isInput: true,
        formulaKeys: [
          { key: "MAT_RHB", weight: 1 },
          { key: "MAT_BL", weight: 1 },
        ],
        children: [
          { key: "MAT_RHB", label: "Davon Aufwendungen für Roh-, Hilfs- und Betriebsstoffe" },
          { key: "MAT_BL", label: "Davon Aufwendungen für bezogene Leistungen" },
        ],
      },
      {
        key: "ROH",
        label: "Rohergebnis",
        isInput: false,
        formulaKeys: [
          { key: "GESAMT", weight: 1 },
          { key: "SBE", weight: 1 },
          { key: "MAT", weight: -1 },
        ],
      },
      {
        key: "PER",
        label: "Personalaufwand",
        isInput: true,
        formulaKeys: [
          { key: "PER_LG", weight: 1 },
          { key: "PER_SA", weight: 1 },
        ],
        children: [
          { key: "PER_LG", label: "Davon Löhne und Gehälter" },
          { key: "PER_SA", label: "Davon soziale Abgaben und Aufwendungen für Unterstützung" },
        ],
      },
      { key: "ABSCH", label: "Abschreibungen" },
      { key: "SBA", label: "Sonstige betriebliche Aufwendungen" },
      {
        key: "BETR",
        label: "Betriebsergebnis",
        isInput: false,
        formulaKeys: [
          { key: "ROH", weight: 1 },
          { key: "PER", weight: -1 },
          { key: "ABSCH", weight: -1 },
          { key: "SBA", weight: -1 },
        ],
      },
      { key: "BETEIL", label: "Beteiligungsergebnis" },
      { key: "ZINS_E", label: "Zinsen und ähnliche Erträge" },
      { key: "ZINS_A", label: "Zinsen und ähnliche Aufwendungen" },
      { key: "UEBR_FIN", label: "Übriges Finanzergebnis" },
      {
        key: "FIN",
        label: "Finanzergebnis",
        isInput: false,
        formulaKeys: [
          { key: "BETEIL", weight: 1 },
          { key: "ZINS_E", weight: 1 },
          { key: "ZINS_A", weight: -1 },
          { key: "UEBR_FIN", weight: 1 },
        ],
      },
      {
        key: "STEUERN",
        label: "Steuern vom Einkommen und Ertrag",
        isInput: true,
        formulaKeys: [
          { key: "STEUERN_LAT", weight: 1 },
          { key: "STEUERN_LAUF", weight: 1 },
        ],
        children: [
          { key: "STEUERN_LAT", label: "Davon latente Steuern" },
          { key: "STEUERN_LAUF", label: "Davon laufende Steuern" },
        ],
      },
      { key: "SONST_ST", label: "Sonstige Steuern" },
      {
        key: "JUE",
        label: "Jahresüberschuss/Jahresfehlbetrag",
        isInput: false,
        formulaKeys: [
          { key: "BETR", weight: 1 },
          { key: "FIN", weight: 1 },
          { key: "STEUERN", weight: -1 },
          { key: "SONST_ST", weight: -1 },
        ],
      },
    ],
  });

  const other = buildStatement({
    prefix: "OTH",
    statementType: StatementType.CASHFLOW,
    nodes: [
      { key: "CASHFLOW", label: "Cashflow", unit: Unit.EUR },
      {
        key: "LATENT_RATE",
        label: "zur Berechnung der latenten Steuern verwendeter Steuersatz (Vorschlag: 39%)",
        unit: Unit.PERCENT,
        isInput: true,
      },
      {
        key: "EMPLOYEES",
        label: "Anzahl der Mitarbeiter im Jahresdurchschnitt (Vollzeitäquivalente)",
        unit: Unit.COUNT,
        isInput: true,
      },
    ],
  });

  return {
    lineItems: [...balanceAsset.lineItems, ...balanceLiab.lineItems, ...ukv.lineItems, ...gkv.lineItems, ...other.lineItems],
    formulasByCode: mergeFormulaMaps(
      balanceAsset.formulasByCode,
      balanceLiab.formulasByCode,
      ukv.formulasByCode,
      gkv.formulasByCode,
      other.formulasByCode
    ),
  };
}
