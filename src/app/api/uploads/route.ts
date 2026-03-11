import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRole } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { uploadSchema } from "@/lib/validation/meal";

export const runtime = "nodejs";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function getFileExtension(file: File) {
  const originalExtension = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : undefined;
  if (originalExtension && /^[a-z0-9]+$/i.test(originalExtension)) {
    return originalExtension;
  }

  return MIME_EXTENSION_MAP[file.type.toLowerCase()] ?? "jpg";
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

    uploadSchema.parse({
      mimeType: file.type,
      sizeBytes: file.size,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = getFileExtension(file);
    const path = `${user.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const storageClient = hasSupabaseServiceRole() ? createAdminClient() : supabase;

    const { error: uploadError } = await storageClient.storage.from("meal-images").upload(path, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = storageClient.storage.from("meal-images").getPublicUrl(path);

    if (process.env.NODE_ENV !== "production") {
      console.info(`[uploads:${requestId}] uploaded`, {
        userId: user.id,
        path,
        sizeBytes: file.size,
        mimeType: file.type,
        usedServiceRole: hasSupabaseServiceRole(),
      });
    }

    return NextResponse.json(
      {
        success: true,
        image: {
          path,
          publicUrl: publicData.publicUrl,
          mimeType: file.type,
          sizeBytes: file.size,
        },
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
