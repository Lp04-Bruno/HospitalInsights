import { redirect } from "next/navigation";

import { z } from "zod";

const flashToneSchema = z.enum(["info", "success", "warning", "danger"]);
const flashMessageSchema = z.object({
  tone: flashToneSchema.default("info"),
  message: z.string().trim().min(1).max(500),
});

export type FlashMessage = z.infer<typeof flashMessageSchema>;

const FLASH_PARAM = "flash";
const LEGACY_NOTICE_PARAM = "notice";

type SearchParamsLike = Record<string, string | string[] | undefined> | undefined;

function getStringParam(searchParams: SearchParamsLike, key: string) {
  const value = searchParams?.[key];
  return typeof value === "string" ? value : undefined;
}

export function encodeFlashMessage(flash: FlashMessage) {
  return JSON.stringify(flashMessageSchema.parse(flash));
}

export function parseFlashMessage(searchParams: SearchParamsLike): FlashMessage | undefined {
  const raw = getStringParam(searchParams, FLASH_PARAM);
  if (raw) {
    try {
      return flashMessageSchema.parse(JSON.parse(raw));
    } catch {
      return { tone: "warning", message: "Die Statusmeldung konnte nicht gelesen werden." };
    }
  }

  const legacyNotice = getStringParam(searchParams, LEGACY_NOTICE_PARAM);
  return legacyNotice ? { tone: "info", message: legacyNotice } : undefined;
}

export function clearFlashSearchParams(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.delete(FLASH_PARAM);
  params.delete(LEGACY_NOTICE_PARAM);
  return params;
}

export function redirectWithFlash(pathname: string, flash: FlashMessage): never {
  const params = new URLSearchParams();
  params.set(FLASH_PARAM, encodeFlashMessage(flash));
  redirect(`${pathname}?${params.toString()}`);
}
