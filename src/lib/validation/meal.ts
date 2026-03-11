import { z } from "zod";
import { ACCEPTED_MEAL_IMAGE_TYPES, MAX_MEAL_IMAGE_UPLOAD_BYTES, MAX_VISION_IMAGE_BYTES } from "@/lib/meal-config";

function toFiniteNonNegative(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
}

const numericValue = z.preprocess((value) => {
  return toFiniteNonNegative(value);
}, z.number().finite().nonnegative());

const confidenceSchema = z.preprocess((value) => {
  if (typeof value === "string") return value.toLowerCase().trim();
  return value;
}, z.enum(["low", "medium", "high"]));

export const mealItemSchema = z.object({
  name: z.string().min(1),
  estimated_quantity: z.string().min(1),
  estimated_portion: z.string().min(1).optional(),
  estimated_calories: numericValue.default(0).transform((value) => Math.round(value)),
  protein_g: numericValue.optional(),
  carbs_g: numericValue.optional(),
  fat_g: numericValue.optional(),
  confidence: confidenceSchema.default("medium"),
  visual_confidence: confidenceSchema.optional(),
  source: z.enum(["ai_estimate", "user_confirmed"]).default("ai_estimate"),
});

export const analysisResultSchema = z.object({
  items: z.array(mealItemSchema).default([]),
  total_estimated_calories: numericValue.default(0).transform((value) => Math.round(value)),
  confidence: confidenceSchema.default("medium"),
  is_food: z.boolean().default(true),
  contains_food: z.boolean().optional(),
  non_food_reason: z.string().max(500).optional(),
  follow_up_questions: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

function estimateDataUrlBytes(value: string) {
  const [, base64 = ""] = value.split(",", 2);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

const imageBase64Schema = z
  .string()
  .startsWith("data:image/")
  .max(6_000_000)
  .refine((value) => estimateDataUrlBytes(value) <= MAX_VISION_IMAGE_BYTES, {
    message: "Image is too large for AI analysis. Please upload a smaller photo.",
  });

export const analyzeMealRequestSchema = z.object({
  imageUrl: z.string().url().optional(),
  imageBase64: imageBase64Schema.optional(),
  mealDescription: z.string().max(1000).optional(),
  locale: z.enum(["he", "en"]).default("he"),
  demoMode: z.boolean().optional().default(false),
}).refine((payload) => Boolean(payload.imageUrl || payload.imageBase64 || payload.mealDescription?.trim()), {
  message: "Please provide an image or meal description",
});

export const chatRequestSchema = z.object({
  locale: z.enum(["he", "en"]).default("he"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(3000),
      }),
    )
    .min(1)
    .max(30),
  analysisContext: analysisResultSchema.optional(),
  demoMode: z.boolean().optional().default(false),
});

export const coachChatRequestSchema = z.object({
  locale: z.enum(["he", "en"]).default("he"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(3000),
      }),
    )
    .min(1)
    .max(40),
});

export const finalizeMealSchema = z.object({
  title: z.string().min(1).max(120),
  status: z.enum(["draft", "pending_confirmation", "confirmed"]).default("confirmed"),
  occurredAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  image: z
    .object({
      path: z.string().min(1),
      publicUrl: z.string().url(),
      mimeType: z.string().min(1),
      sizeBytes: z.number().int().positive(),
    })
    .optional(),
  analysis: analysisResultSchema,
  items: z.array(mealItemSchema).min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      }),
    )
    .default([]),
  conversationSummary: z.string().max(2000).optional(),
});

export const uploadSchema = z.object({
  mimeType: z.string().refine((value) => ACCEPTED_MEAL_IMAGE_TYPES.includes(value.toLowerCase() as (typeof ACCEPTED_MEAL_IMAGE_TYPES)[number]), {
    message: "Unsupported image type",
  }),
  sizeBytes: z.number().max(MAX_MEAL_IMAGE_UPLOAD_BYTES),
});

