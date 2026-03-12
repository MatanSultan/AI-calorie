import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { storeMealImage } from "@/lib/meals/store-image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function getUploadStatus(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("unauthorized")) return 401;
  if (message.includes("row-level security") || message.includes("permission")) return 403;
  if (message.includes("size") || message.includes("too large")) return 413;
  if (message.includes("unsupported") || message.includes("mime")) return 415;
  if (
    message.includes("bucket") ||
    message.includes("storage") ||
    message.includes("network") ||
    message.includes("service unavailable")
  ) {
    return 503;
  }

  return 500;
}

function getUploadCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("bucket")) return "SUPABASE_STORAGE_BUCKET_MISSING";
  if (message.includes("row-level security") || message.includes("permission")) return "SUPABASE_STORAGE_RLS_DENIED";
  if (message.includes("unauthorized")) return "AUTH_REQUIRED";
  if (message.includes("too large") || message.includes("size")) return "IMAGE_TOO_LARGE";
  if (message.includes("unsupported")) return "IMAGE_UNSUPPORTED";
  return "UPLOAD_FAILED";
}

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
    }

    const formData = await request.formData();
    const maybeFile = formData.get("file") ?? formData.get("image");
    const file = maybeFile instanceof File ? maybeFile : null;

    if (!file) {
      return NextResponse.json(
        {
          error: "No image file was provided. Attach the file using the `file` field.",
          code: "FILE_MISSING",
        },
        { status: 400 },
      );
    }

    const storedImage = await storeMealImage(supabase, {
      userId: user.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    if (isDevelopment()) {
      console.info(`[uploads:${requestId}] uploaded`, {
        userId: user.id,
        path: storedImage.path,
        sizeBytes: file.size,
        mimeType: file.type,
      });
    }

    return NextResponse.json(
      {
        success: true,
        image: storedImage,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (isDevelopment()) {
      console.error(`[uploads:${requestId}] failed`, error);
    }

    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Invalid image upload.";
      const status = message.toLowerCase().includes("unsupported") ? 415 : 413;
      return NextResponse.json(
        {
          error: message,
          code: status === 415 ? "IMAGE_UNSUPPORTED" : "IMAGE_TOO_LARGE",
          requestId,
        },
        { status },
      );
    }

    const status = getUploadStatus(error);
    const payload: Record<string, unknown> = {
      error:
        error instanceof Error
          ? error.message
          : "Image upload failed. You can still save the meal without attaching the image.",
      code: getUploadCode(error),
      requestId,
    };

    if (isDevelopment() && error && typeof error === "object") {
      const maybeError = error as { message?: string; name?: string; stack?: string; code?: string; details?: string; hint?: string };
      payload.debug = {
        name: maybeError.name ?? null,
        code: maybeError.code ?? null,
        details: maybeError.details ?? null,
        hint: maybeError.hint ?? null,
      };
    }

    return NextResponse.json(payload, { status });
  }
}
