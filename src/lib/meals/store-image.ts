import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRole } from "@/lib/supabase/config";
import { uploadSchema } from "@/lib/validation/meal";

const BUCKET_NAME = "meal-images";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type StoredMealImage = {
  path: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};

type UploadableMealImage = {
  userId: string;
  fileName?: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

function getFileExtension(fileName: string | undefined, mimeType: string) {
  const originalExtension = fileName?.includes(".") ? fileName.split(".").pop()?.toLowerCase() : undefined;
  if (originalExtension && /^[a-z0-9]+$/i.test(originalExtension)) {
    return originalExtension;
  }

  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? "jpg";
}

async function ensureMealImagesBucket(adminClient: SupabaseClient) {
  const { data: bucket, error: getBucketError } = await adminClient.storage.getBucket(BUCKET_NAME);
  if (bucket && !getBucketError) return;

  const { error: createBucketError } = await adminClient.storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: "8MB",
    allowedMimeTypes: Object.keys(MIME_EXTENSION_MAP),
  });

  if (createBucketError && createBucketError.message.toLowerCase().includes("already exists") === false) {
    throw new Error(`Supabase storage bucket '${BUCKET_NAME}' is unavailable: ${createBucketError.message}`);
  }
}

export async function storeMealImage(
  supabase: SupabaseClient,
  image: UploadableMealImage,
): Promise<StoredMealImage> {
  uploadSchema.parse({
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
  });

  const extension = getFileExtension(image.fileName, image.mimeType);
  const path = `${image.userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;

  let storageClient: SupabaseClient = supabase;
  if (hasSupabaseServiceRole()) {
    storageClient = createAdminClient();
    await ensureMealImagesBucket(storageClient);
  }

  const { error: uploadError } = await storageClient.storage.from(BUCKET_NAME).upload(path, image.buffer, {
    contentType: image.mimeType,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    const message = uploadError.message.toLowerCase();
    if (message.includes("bucket")) {
      throw new Error(
        `Supabase storage bucket '${BUCKET_NAME}' is missing or unavailable. Run the storage migration or add SUPABASE_SERVICE_ROLE_KEY so the server can provision it.`,
      );
    }

    throw uploadError;
  }

  const { data: publicData } = storageClient.storage.from(BUCKET_NAME).getPublicUrl(path);

  return {
    path,
    publicUrl: publicData.publicUrl,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
  };
}

export function decodeDataUrlImage(dataUrl: string, fileName = `meal-${Date.now()}.jpg`) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image data");
  }

  return {
    fileName,
    mimeType: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
}
