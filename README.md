# Image Fusion App

A single-screen web app that uploads two images, sends them through a server-side proxy to an [n8n](https://n8n.io/) webhook, and renders the fused image returned in the response.

Built with **Next.js 15** (App Router), **React 19**, **TypeScript**, and **Tailwind CSS**. Designed for zero-config deployment to **Vercel**.

## Quick start

```bash
npm install
cp .env.example .env.local       # then edit .env.local
npm run dev                       # http://localhost:3000
```

### Required environment variable

| Var | Required | Description |
| --- | --- | --- |
| `N8N_WEBHOOK_URL` | yes | Full HTTPS URL of the n8n webhook that accepts `image1` + `image2` as multipart fields and returns a single image. The server throws at boot if this is unset — there is no hardcoded fallback. |

For Vercel: set the variable in **Project Settings → Environment Variables**.

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

- **Webhook URL** lives only in `lib/server-config.ts` (marked `import "server-only"`) so it cannot end up in the client bundle.
- **Same-origin check** on `/api/fuse` (Origin vs Host) blocks cross-site POSTs.
- **Magic-byte sniffing** re-validates each upload server-side.
- **Outbound filenames** are sanitized (no path separators, no control chars, length-capped).
- **Upstream content-type** is allowlisted (`image/jpeg | png | webp`) before bytes are streamed back.
- **Security headers** in `next.config.ts`: CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, COOP. `poweredByHeader` is off.

## Project layout

```
app/
  page.tsx              # Single-screen UI (client component)
  layout.tsx
  globals.css
  api/fuse/route.ts     # Server proxy to n8n
components/
  ImageDropzone.tsx     # Reusable upload field with client validation + preview
lib/
  constants.ts          # Shared client + server constants (UI strings, limits)
  server-config.ts      # server-only: webhook URL, upstream timeout
  validate.ts           # validateImageFile() — type + size
  magic.ts              # Server-side magic-byte sniffing
next.config.ts          # Security headers (CSP relaxed for dev, strict for prod)
```

## Deploy to Vercel

```bash
npx vercel              # follow prompts; set N8N_WEBHOOK_URL when asked
npx vercel --prod
```

Or import the repo in the Vercel dashboard and set `N8N_WEBHOOK_URL` under Environment Variables.

## License

Private / unlicensed.
