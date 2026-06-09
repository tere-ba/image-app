"use client";

import { useEffect, useState } from "react";
import { ImageDropzone } from "@/components/ImageDropzone";
import { CLIENT_TIMEOUT_MS, ERROR_MESSAGES } from "@/lib/constants";

export function FusionTool() {
  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  const canSubmit = !!image1 && !!image2 && !loading;

  async function onSubmit() {
    if (!image1 || !image2) return;
    setLoading(true);
    setError(null);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    const fd = new FormData();
    fd.append("image1", image1);
    fd.append("image2", image2);

    try {
      const res = await fetch("/api/fuse", {
        method: "POST",
        body: fd,
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });

      if (!res.ok) {
        let msg: string = ERROR_MESSAGES.processing;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {}
        setError(msg);
        return;
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
    } catch (err) {
      const isTimeout =
        err instanceof DOMException && err.name === "TimeoutError";
      setError(isTimeout ? ERROR_MESSAGES.processing : ERROR_MESSAGES.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ImageDropzone
            label="Image 1"
            disabled={loading}
            onChange={(file) => setImage1(file)}
          />
          <ImageDropzone
            label="Image 2"
            disabled={loading}
            onChange={(file) => setImage2(file)}
          />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            aria-busy={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {loading ? (
              <>
                <Spinner /> Fusing…
              </>
            ) : (
              "Fuse Images"
            )}
          </button>
        </div>
      </section>

      <section className="mt-8">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {resultUrl && !error && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-neutral-700">
              Fused image
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Fused result"
              className="mx-auto max-h-[70vh] w-auto rounded-lg"
            />
          </div>
        )}

        {!resultUrl && !error && !loading && (
          <p className="text-center text-sm text-neutral-500">
            The fused image will appear here.
          </p>
        )}
      </section>
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
