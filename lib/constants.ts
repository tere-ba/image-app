export const ALLOWED_TYPES = ["image/jpeg", "image/webp"] as const;
export const MAX_BYTES = 5 * 1024 * 1024;
export const N8N_TIMEOUT_MS = 60_000;
export const CLIENT_TIMEOUT_MS = 65_000;

export const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ??
  "https://t2talbot.app.n8n.cloud/webhook/b6b89683-20d9-4ba7-b029-74cff5ea3450";

export const ERROR_MESSAGES = {
  fileSize: "ERROR file size",
  fileType: "ERROR file type",
  network: "ERROR network connection",
  processing: "ERROR n8n processing",
} as const;
