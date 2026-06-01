import { ALLOWED_TYPES, ERROR_MESSAGES, MAX_BYTES } from "./constants";

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateImageFile(file: File): ValidationResult {
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: ERROR_MESSAGES.fileType };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: ERROR_MESSAGES.fileSize };
  }
  return { ok: true };
}
