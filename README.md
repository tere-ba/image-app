# Image Fusion App

A web app that uploads two images, sends them through a server-side proxy to an [n8n](https://n8n.io/) webhook, and renders the fused image returned in the response. The tool is behind email/password login backed by [Supabase Auth](https://supabase.com/auth).

Built with **Next.js 15** (App Router), **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase**. Designed for zero-config deployment to **Vercel**.

## Quick start

```bash
npm install
cp .env.example .env.local       # then edit .env.local
npm run dev                       # http://localhost:3000
```

### Required environment variables

| Var | Required | Description |
| --- | --- | --- |
| `N8N_WEBHOOK_URL` | yes | Full HTTPS URL of the n8n webhook that accepts `image1` + `image2` as multipart fields and returns a single image. The server throws at boot if this is unset — there is no hardcoded fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (e.g. `https://<ref>.supabase.co`). Used by the auth client; the middleware returns a clear 500 if it is missing. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase publishable / anon key. Safe to ship in the client bundle — row-level security enforces access. |

For Vercel: set all three in **Project Settings → Environment Variables**, then redeploy (env changes don't apply to existing deployments).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server with Fast Refresh |
| `npm run build` | Production build (full TypeScript + ESLint check) |
| `npm run start` | Serve the production build |
| `npm run lint` | Next.js ESLint |

There is no test suite.

## How it works

```
Browser                       Next.js server                 n8n
─────────                     ──────────────                 ────
[two file inputs]
       │
       │ POST /api/fuse  (multipart, same-origin)
       ▼
                        [origin check]
                        [size + magic-byte validation]
                        [sanitize filenames]
                              │
                              │ POST multipart, 60s timeout
                              ▼
                                                       [process]
                              ◀───── image bytes ──────
                        [allowlist content-type]
       ◀── image bytes ──
[<img src={blob URL}>]
```

The `/api/fuse` route exists to keep the n8n webhook off the browser — it avoids CORS, hides the webhook URL from the client bundle, and centralizes timeout + error mapping.

## Authentication

The whole app is gated behind login. Users **sign up with name + email + password**, and must be authenticated to reach the fusion tool or call `/api/fuse`.

- Cookie-based sessions via [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs) — a browser client (`lib/supabase/client.ts`) for the forms, a server client (`lib/supabase/server.ts`) for route handlers/server components.
- `middleware.ts` refreshes the session on every request and redirects unauthenticated visitors to `/login` (logged-in users on `/login`/`/signup` are sent to `/`). `/api/*` is exempt from the redirect so API routes return their own JSON/401 instead of HTML.
- On signup the name is stored in Supabase `user_metadata` **and** mirrored into a `public.profiles` table (RLS + an `on_auth_user_created` trigger) so it's queryable.
- **Instant login**: the project has email confirmation **disabled** in the Supabase dashboard (Authentication → Sign In / Providers → Email), so `signUp` returns an active session immediately.

| Route | Purpose |
| --- | --- |
| `/login` | Email + password sign-in |
| `/signup` | Name + email + password registration |
| `/auth/signout` | POST → `signOut()` → redirect to `/login` |

## Validation rules

- **Allowed types**: JPEG, WebP (verified by **magic bytes** server-side, not just the client-supplied MIME header).
- **Max per file**: 5 MB.
- **Max request body**: ~11 MB (2 × 5 MB + multipart overhead).
- **Server → n8n timeout**: 60 s. Client timeout is 65 s, so the server-side timeout always wins and surfaces a clean error.

## Error contract

Errors are surfaced verbatim in the UI as one of these strings:

| When | Message |
| --- | --- |
| File is not JPEG/WebP (or bytes don't match) | `ERROR file type` |
| File > 5 MB | `ERROR file size` |
| Network failure / cross-origin POST | `ERROR network connection` |
| n8n timeout or non-2xx response | `ERROR n8n processing` |

## Security

The app is locked down by default:

- **Login required**: middleware gates every page and `/api/fuse` re-checks the session server-side (`401` if unauthenticated).
- **Webhook URL** lives only in `lib/server-config.ts` (marked `import "server-only"`) so it cannot end up in the client bundle.
- **Same-origin check** on `/api/fuse` (Origin vs Host) blocks cross-site POSTs.
- **Magic-byte sniffing** re-validates each upload server-side.
- **Outbound filenames** are sanitized (no path separators, no control chars, length-capped).
- **Upstream content-type** is allowlisted (`image/jpeg | png | webp`) before bytes are streamed back.
- **Security headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, COOP. `poweredByHeader` is off.

## Project layout

```
app/
  page.tsx              # Server component: auth header + sign out, renders FusionTool
  layout.tsx
  globals.css
  login/page.tsx        # Email + password sign-in
  signup/page.tsx       # Name + email + password registration
  auth/signout/route.ts # POST → signOut() → redirect to /login
  api/fuse/route.ts     # Server proxy to n8n (requires a session)
components/
  ImageDropzone.tsx     # Reusable upload field with client validation + preview
  FusionTool.tsx        # Client component: the two-image fusion UI
lib/
  constants.ts          # Shared client + server constants (UI strings, limits)
  server-config.ts      # server-only: webhook URL, upstream timeout
  validate.ts           # validateImageFile() — type + size
  magic.ts              # Server-side magic-byte sniffing
  supabase/
    client.ts           # Browser Supabase client
    server.ts           # Server Supabase client (cookie-wired)
    middleware.ts       # Session refresh + login-gate logic
middleware.ts           # Runs the auth gate on every request
next.config.ts          # Security headers (CSP relaxed for dev, strict for prod)
```

## Deploy to Vercel

```bash
npx vercel              # follow prompts
npx vercel --prod
```

Set `N8N_WEBHOOK_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Environment Variables** (dashboard or CLI), then redeploy. A missing Supabase var surfaces as a clear 500 from the middleware naming exactly what to set.

## License

Private / unlicensed.
