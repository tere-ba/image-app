"use client";

import { useEffect, useId, useRef, useState } from "react";
import { validateImageFile } from "@/lib/validate";

type Props = {
  label: string;
  onChange: (file: File | null, error: string | null) => void;
  disabled?: boolean;
};

export function ImageDropzone({ label, onChange, disabled }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);

    if (!file) {
      setPreview(null);
      setFileName(null);
      setLocalError(null);
      onChange(null, null);
      return;
    }

    const v = validateImageFile(file);
    if (!v.ok) {
      setPreview(null);
      setFileName(null);
      setLocalError(v.error);
      onChange(null, v.error);
      return;
    }

    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setLocalError(null);
    onChange(file, null);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    handleFile(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
        {label}
      </label>

      <div
        className={`relative flex h-56 items-center justify-center rounded-lg border-2 border-dashed transition ${
          localError
            ? "border-red-400 bg-red-50"
            : preview
              ? "border-neutral-300 bg-white"
              : "border-neutral-300 bg-neutral-100 hover:bg-neutral-50"
        }`}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt={`${label} preview`}
              className="h-full w-full rounded-lg object-contain p-2"
            />
            <button
              type="button"
              onClick={clear}
              disabled={disabled}
              className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-neutral-700 shadow hover:bg-white disabled:opacity-50"
            >
              Remove
            </button>
          </>
        ) : (
          <label
            htmlFor={inputId}
            className="cursor-pointer text-center text-sm text-neutral-500"
          >
            <div className="font-medium text-neutral-700">Click to upload</div>
            <div className="mt-1 text-xs">JPEG or WebP · max 5 MB</div>
          </label>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {fileName && !localError && (
        <p className="truncate text-xs text-neutral-500">{fileName}</p>
      )}
      {localError && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {localError}
        </p>
      )}
    </div>
  );
}
