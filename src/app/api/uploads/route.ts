import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { storeMealImage } from "@/lib/meals/store-image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const maybeFile = formData.get("file") ?? formData.get("image");
    const file = maybeFile instanceof File ? maybeFile : null;

    if (!file) {
      return NextResponse.json(
        { error: "No image file was provided. Attach the file using the `file` field." },
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

    if (process.env.NODE_ENV !== "production") {
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
    if (process.env.NODE_ENV !== "production") {
      console.error(`[uploads:${requestId}] failed`, error);
    }

    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Invalid image upload.";
      const status = message.toLowerCase().includes("unsupported") ? 415 : 413;
      return NextResponse.json({ error: message }, { status });
    }

    const status = getUploadStatus(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Image upload failed. You can still save the meal without attaching the image.",
      },
      { status },
    );
  }
}
