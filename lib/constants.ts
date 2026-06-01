export const ALLOWED_TYPES = ["image/jpeg", "image/webp"] as const;
export const MAX_BYTES = 5 * 1024 * 1024;
export const CLIENT_TIMEOUT_MS = 65_000;

export const ERROR_MESSAGES = {
  fileSize: "ERROR file size",
  fileType: "ERROR file type",
  network: "ERROR network connection",
  processing: "ERROR n8n processing",
} as const;
