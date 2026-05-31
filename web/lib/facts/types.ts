import type { StatementType, Unit } from "@/prisma/generated/enums";

export type FlatRow = {
  code: string;
  depth: number;
  label: string;
  unit: Unit;
  isInput: boolean;
  isSection: boolean;
  hasChildren: boolean;
  isCollapsible: boolean;
  prettyValue: string;
  suggestedPrettyValue?: string;
};

export type SaveFactsState = {
  ok: boolean;
  message?: string;
  globalError?: string;
  savedAt?: string;
  savedBy?: string;
  changesApplied?: number;
  fieldErrors?: Record<string, string>;
};

export type SaveFactsAction = (prevState: SaveFactsState, formData: FormData) => Promise<SaveFactsState>;

export type StatementLineItem = {
  code: string;
  label: string;
  unit: Unit;
  isInput: boolean;
  parentCode: string | null;
  sortOrder?: number;
  statementType?: StatementType;
};
