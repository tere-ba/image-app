import { NextResponse } from "next/server";
import {
  ERROR_MESSAGES,
  N8N_TIMEOUT_MS,
  N8N_WEBHOOK_URL,
} from "@/lib/constants";
import { validateImageFile } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
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

  for (const f of [image1, image2]) {
    const v = validateImageFile(f);
    if (!v.ok) return errorResponse(v.error, 400);
  }

  const outbound = new FormData();
  outbound.append("image1", image1, image1.name);
  outbound.append("image2", image2, image2.name);

  try {
    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      body: outbound,
      signal: AbortSignal.timeout(N8N_TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return errorResponse(ERROR_MESSAGES.processing, 502);
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return errorResponse(ERROR_MESSAGES.processing, 502);
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isTimeout =
      err instanceof DOMException && err.name === "TimeoutError";
    if (isTimeout) return errorResponse(ERROR_MESSAGES.processing, 504);
    return errorResponse(ERROR_MESSAGES.network, 502);
  }
}
