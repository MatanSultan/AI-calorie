export const MAX_MEAL_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_VISION_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_LOCAL_MEAL_SOURCE_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_MEAL_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
