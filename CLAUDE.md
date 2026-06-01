# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server at http://localhost:3000
- `npm run build` — production build (also runs full TypeScript + lint check)
- `npm run start` — serve the production build
- `npm run lint` — Next.js ESLint

There is no test suite.

## Architecture

Single-screen Next.js 15 App Router app (TypeScript, React 19, Tailwind). It accepts two images from the user, proxies them to an n8n webhook as `multipart/form-data`, and renders the single fused image returned in the response.

**Request flow:**

```
app/page.tsx (client)
   └── POST FormData → /api/fuse  (same-origin, no CORS)
                          └── app/api/fuse/route.ts (Node runtime)
                                └── POST multipart → N8N_WEBHOOK_URL
                                └── streams image bytes back to client
                                └── client: URL.createObjectURL(blob) → <img>
```

The server route exists specifically to keep the n8n call off the browser (avoids CORS and centralizes the timeout + error mapping). Do not call the webhook directly from the client.

**Timeouts are layered intentionally:**
- Server → n8n: `N8N_TIMEOUT_MS = 60_000` (per spec)
- Client → `/api/fuse`: `CLIENT_TIMEOUT_MS = 65_000` (slightly longer so the server timeout fires first and returns a clean `ERROR n8n processing` JSON, rather than the client aborting with a generic network error)

**Error contract (`lib/constants.ts → ERROR_MESSAGES`):** the UI displays these strings verbatim. Always reuse the constants — do not introduce new error wording. Both client (`lib/validate.ts`) and server (`app/api/fuse/route.ts`) re-run the same `validateImageFile` check; keep them in sync via the shared `lib/`.

**Config:** `N8N_WEBHOOK_URL` reads from `process.env.N8N_WEBHOOK_URL` with a hardcoded fallback in `lib/constants.ts`. For production (Vercel) set the env var rather than editing the fallback.

**Object URL lifecycle:** previews (`ImageDropzone`) and the final result (`page.tsx`) both create blob URLs via `URL.createObjectURL`. Both revoke on unmount and on replacement — preserve this when editing or memory will leak.

## Conventions

- Path alias `@/*` is configured in `tsconfig.json` — import as `@/lib/...`, `@/components/...`.
- The `app/api/fuse/route.ts` handler must stay on the Node runtime (`export const runtime = "nodejs"`) — Edge has stricter multipart body limits.
- Plain `<img>` is used (with `eslint-disable-next-line @next/next/no-img-element`) because the fused result is an in-memory blob URL, not something `next/image` can optimize.
