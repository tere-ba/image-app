import { NextResponse } from "next/server";
import { ERROR_MESSAGES, MAX_BYTES } from "@/lib/constants";
import {
  ALLOWED_RESPONSE_TYPES,
  MAX_REQUEST_BYTES,
  N8N_TIMEOUT_MS,
  N8N_WEBHOOK_URL,
} from "@/lib/server-config";
import { sniffImageType } from "@/lib/magic";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // 1. CSRF mitigation: only accept browser requests from our own origin.
  if (!isSameOrigin(req)) {
    return errorResponse(ERROR_MESSAGES.network, 403);
  }

  // 2. Require an authenticated session — the fusion tool is login-gated.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse(ERROR_MESSAGES.network, 401);
  }

  // 3. Reject obviously oversized requests before parsing the body.
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse(ERROR_MESSAGES.fileSize, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(ERROR_MESSAGES.processing, 400);
  }

  const image1 = form.get("image1");
  const image2 = form.get("image2");

  if (!(image1 instanceof File) || !(image2 instanceof File)) {
    return errorResponse(ERROR_MESSAGES.fileType, 400);
  }

  // 4. Per-file size check (the client MIME header is not trusted).
  for (const f of [image1, image2]) {
    if (f.size === 0 || f.size > MAX_BYTES) {
      return errorResponse(ERROR_MESSAGES.fileSize, 400);
    }
  }

  // 5. Magic-byte sniff — verify each file is actually JPEG or WebP.
  const buf1 = new Uint8Array(await image1.arrayBuffer());
  const buf2 = new Uint8Array(await image2.arrayBuffer());
  if (!sniffImageType(buf1) || !sniffImageType(buf2)) {
    return errorResponse(ERROR_MESSAGES.fileType, 400);
  }

  // 6. Build a clean outbound form with sanitized filenames (strip path components).
  const outbound = new FormData();
  outbound.append(
    "image1",
    new Blob([buf1], { type: sniffImageType(buf1)! }),
    safeFilename(image1.name, sniffImageType(buf1)!),
  );
  outbound.append(
    "image2",
    new Blob([buf2], { type: sniffImageType(buf2)! }),
    safeFilename(image2.name, sniffImageType(buf2)!),
  );

  try {
    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      body: outbound,
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
      // Avoid sending any ambient credentials.
      redirect: "error",
    });

    if (!upstream.ok) {
      return errorResponse(ERROR_MESSAGES.processing, 502);
    }

    // 7. Allowlist upstream content-type before streaming bytes back.
    const upstreamType = (upstream.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!(ALLOWED_RESPONSE_TYPES as readonly string[]).includes(upstreamType)) {
      return errorResponse(ERROR_MESSAGES.processing, 502);
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": upstreamType,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline; filename=\"fused.img\"",
      },
    });
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && err.name === "TimeoutError";
    if (isTimeout) return errorResponse(ERROR_MESSAGES.processing, 504);
    return errorResponse(ERROR_MESSAGES.network, 502);
  }
}

function safeFilename(raw: string, mime: "image/jpeg" | "image/webp"): string {
  const ext = mime === "image/jpeg" ? "jpg" : "webp";
  // Strip path separators and control chars; cap length.
  const base = raw.replace(/[\\/\x00-\x1f]/g, "_").slice(-64) || `upload`;
  return base.includes(".") ? base : `${base}.${ext}`;
}
