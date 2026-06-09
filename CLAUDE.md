# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Next.js dev server at http://localhost:3000
- `npm run build` — production build (also runs full TypeScript + lint check)
- `npm run start` — serve the production build
- `npm run lint` — Next.js ESLint

There is no test suite.

## Architecture

Next.js 15 App Router app (TypeScript, React 19, Tailwind) gated behind Supabase email/password auth. Once logged in, the user uploads two images; the app proxies them to an n8n webhook as `multipart/form-data` and renders the single fused image returned in the response.

**Request flow:**

```
app/page.tsx (server component — reads session, renders header + sign out)
   └── components/FusionTool.tsx (client — the upload UI)
        └── POST FormData → /api/fuse  (same-origin, no CORS)
                          └── app/api/fuse/route.ts (Node runtime)
                                └── auth: getUser() → 401 if no session
                                └── POST multipart → N8N_WEBHOOK_URL
                                └── streams image bytes back to client
                                └── client: URL.createObjectURL(blob) → <img>
```

The server route exists specifically to keep the n8n call off the browser (avoids CORS and centralizes the timeout + error mapping). Do not call the webhook directly from the client.

`app/page.tsx` is a **server component** (it reads the Supabase session for the header); the interactive fusion UI lives in `components/FusionTool.tsx` (`"use client"`). Keep that split — don't merge them back or the page can't read the session server-side.

**Timeouts are layered intentionally:**
- Server → n8n: `N8N_TIMEOUT_MS = 60_000` (per spec)
- Client → `/api/fuse`: `CLIENT_TIMEOUT_MS = 65_000` (slightly longer so the server timeout fires first and returns a clean `ERROR n8n processing` JSON, rather than the client aborting with a generic network error)

**Error contract (`lib/constants.ts → ERROR_MESSAGES`):** the UI displays these strings verbatim. Always reuse the constants — do not introduce new error wording. Both client (`lib/validate.ts`) and server (`app/api/fuse/route.ts`) re-run the same `validateImageFile` check; keep them in sync via the shared `lib/`.

**Authentication (`@supabase/ssr`, cookie-based):**
- Three helpers in `lib/supabase/`: `client.ts` (browser, for the login/signup forms), `server.ts` (server, cookie-wired via `next/headers` — `cookies()` is **async** in Next 15, so `createClient()` is `async`/awaited), and `middleware.ts` (`updateSession`).
- Root `middleware.ts` runs `updateSession` on every matched request: it refreshes the session cookie and enforces the gate — unauthenticated → redirect to `/login`; logged-in on `/login`/`/signup` → redirect to `/`. **`/api/*` is intentionally exempt from the redirect** (`isPublicPath`) so API routes return their own JSON/`401` instead of a fetch silently following a 307 to the HTML login page.
- Do not insert code between `createServerClient(...)` and `auth.getUser()` in `updateSession` — per Supabase docs it causes hard-to-debug session-refresh bugs.
- Signup stores the name in `user_metadata` (`options.data.name`) **and** a `public.profiles` table, populated by the `on_auth_user_created` trigger (`handle_new_user`, SECURITY DEFINER with EXECUTE revoked from `anon`/`authenticated`). Profiles have owner-only RLS.
- **Instant login** depends on email confirmation being **off** in the Supabase dashboard (Authentication → Sign In / Providers → Email). With it on, `signUp` returns no session and the signup page shows a "confirm your email" message instead of logging in.
- Auth error strings shown in the login/signup UI are **separate** from `ERROR_MESSAGES` (which is reserved for the fuse-flow contract). Don't reuse those constants for auth.

**Config:** `N8N_WEBHOOK_URL` is **required** — read in `lib/server-config.ts`, which throws at boot if unset. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are also required; the middleware returns a clear plain-text 500 (naming the missing var) instead of an opaque `MIDDLEWARE_INVOCATION_FAILED` if either is unset — this is the usual cause of a Vercel 500 after deploy (env vars not set there). Local dev uses `.env.local` (gitignored, see `.env.example`); production sets all three in the hosting provider's env config and must redeploy. Never reintroduce a hardcoded fallback in `lib/constants.ts` — that file is reachable from client code and would leak the URL into the bundle.

**Module split (security-critical):**
- `lib/constants.ts` — shared client + server (UI strings, validation limits). Safe to import anywhere.
- `lib/server-config.ts` — marked `import "server-only"`; holds the webhook URL, upstream timeout, and response-type allowlist. Importing it from a client component is a build error by design.
- `lib/magic.ts` — server-side magic-byte sniffing (`sniffImageType`). The client-supplied multipart MIME header is not trusted; the route re-verifies actual file bytes.
- `lib/supabase/{client,server,middleware}.ts` — auth clients. `client.ts` is the only one safe to import from client components; `server.ts` and `middleware.ts` read cookies and must stay server/middleware-side.

**API route hardening (`app/api/fuse/route.ts`):** same-origin check (Origin vs Host), `content-length` cap before parsing, per-file size check, magic-byte sniff, sanitized outbound filenames, `redirect: "error"` on the upstream fetch, and an allowlist of upstream content-types before streaming back. Keep these — they're load-bearing, not decorative.

**Security headers** are set globally in `next.config.ts` (CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, `poweredByHeader: false`). The CSP allows `img-src blob:` because previews and the fused result are rendered from `URL.createObjectURL`, and `connect-src` allows the Supabase origin (in **both** dev and prod) because the browser auth client calls it directly — without that, signup/login fetches are blocked. If you add external scripts/styles/fonts/APIs, widen the relevant directive explicitly rather than loosening `default-src`.

**CSP dev vs prod (gotcha):** `script-src` adds `'unsafe-eval'` and `connect-src` adds `ws:`/`wss:` only when `NODE_ENV !== "production"`. Without them, webpack HMR and Fast Refresh are blocked, the client bundle never hydrates, and every `onClick` silently no-ops (the page loads but feels frozen). Production keeps both locked down. If `onClick` handlers stop working in dev, suspect CSP first — DevTools console will show eval/ws violations.

**Object URL lifecycle:** previews (`ImageDropzone`) and the final result (`FusionTool`) both create blob URLs via `URL.createObjectURL`. Both revoke on unmount and on replacement — preserve this when editing or memory will leak.

## Conventions

- Path alias `@/*` is configured in `tsconfig.json` — import as `@/lib/...`, `@/components/...`.
- The `app/api/fuse/route.ts` handler must stay on the Node runtime (`export const runtime = "nodejs"`) — Edge has stricter multipart body limits.
- Plain `<img>` is used (with `eslint-disable-next-line @next/next/no-img-element`) because the fused result is an in-memory blob URL, not something `next/image` can optimize.
- `ImageDropzone` uses `role="button"` + `inputRef.click()` rather than `<label htmlFor>` association. The earlier `useId()`-based labels were flaky (colon-containing IDs). Inner text uses `pointer-events-none` so clicks reach the dropzone div; the Remove button uses `stopPropagation` so it doesn't re-open the picker.
