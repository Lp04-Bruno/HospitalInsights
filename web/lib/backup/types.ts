export type BackupKind = "daily" | "manual" | "upload" | "data" | "unknown";

export type RestoreMode = "replace" | "append";

export type BackupAnalysis = {
  filename: string;
  kind: BackupKind;
  format: "custom" | "unknown";
  hasSchema: boolean;
  hasData: boolean;
  tableData: Array<{ schema: string; table: string }>;
};

export type BackupInfo = {
  filename: string;
  kind: BackupKind;
  sizeBytes: number;
  createdAt: Date;
};
