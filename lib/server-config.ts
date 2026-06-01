import "server-only";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in .env.local (development) or your hosting provider's env config (production).`,
    );
  }
  return value;
}

export const N8N_WEBHOOK_URL = requireEnv("N8N_WEBHOOK_URL");
export const N8N_TIMEOUT_MS = 60_000;

// Total request body cap: 2 images * 5 MB + multipart overhead headroom.
export const MAX_REQUEST_BYTES = 11 * 1024 * 1024;

// Restrict what we will stream back to the client from upstream.
export const ALLOWED_RESPONSE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
