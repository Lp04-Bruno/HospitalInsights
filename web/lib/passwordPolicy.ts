import crypto from "node:crypto";

import { z } from "zod";

export const PASSWORD_POLICY_MESSAGE =
  "Passwörter müssen 12 bis 128 Zeichen lang sein und Kleinbuchstaben, Großbuchstaben, Zahlen und Sonderzeichen enthalten.";

export const passwordSchema = z
  .string()
  .min(12, PASSWORD_POLICY_MESSAGE)
  .max(128, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE);

const charSets = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  symbol: "!@#$%&*+-_?",
} as const;

const allChars = Object.values(charSets).join("");

function randomChar(chars: string) {
  return chars[crypto.randomInt(0, chars.length)];
}

function shuffle(chars: string[]) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

export function generateTemporaryPassword(length = 18) {
  const safeLength = Math.max(12, Math.min(128, length));
  const chars = [randomChar(charSets.lower), randomChar(charSets.upper), randomChar(charSets.digit), randomChar(charSets.symbol)];

  while (chars.length < safeLength) {
    chars.push(randomChar(allChars));
  }

  return shuffle(chars).join("");
}
