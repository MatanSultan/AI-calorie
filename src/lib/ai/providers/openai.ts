import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { buildAnalysisUserPrompt, chatSystemPrompt, mealAnalysisSystemPrompt } from "@/lib/ai/prompts";
import { AIConfigurationError } from "@/lib/ai/errors";
import type { Confidence } from "@/lib/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const FALLBACK_OPENAI_MODELS = ["gpt-4o-mini", "gpt-4.1-mini"];

function uniqueModels(...groups: string[][]) {
  return [...new Set(groups.flat().map((value) => value.trim()).filter(Boolean))];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asNonEmptyString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function asNonNegativeNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function normalizeConfidence(value: unknown): Confidence {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function normalizeSource(value: unknown): "ai_estimate" | "user_confirmed" {
  return value === "user_confirmed" ? "user_confirmed" : "ai_estimate";
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function parseBooleanOrUndefined(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function normalizeItems(items: unknown, locale: AnalyzeMealInput["locale"]) {
  if (!Array.isArray(items)) return [];

  return items.map((entry, index) => {
    const item = asRecord(entry);
    const confidence = normalizeConfidence(item.confidence ?? item.visual_confidence);
    const visualConfidence = normalizeConfidence(item.visual_confidence ?? item.confidence);
    const portion = asNonEmptyString(
      item.estimated_portion ?? item.estimated_quantity,
      locale === "he" ? "מנה אחת" : "1 serving",
    );

    return {
      name: asNonEmptyString(item.name, locale === "he" ? `פריט ${index + 1}` : `Item ${index + 1}`),
      estimated_quantity: portion,
      estimated_portion: portion,
      estimated_calories: Math.round(asNonNegativeNumber(item.estimated_calories) ?? 0),
      protein_g: asNonNegativeNumber(item.protein_g),
      carbs_g: asNonNegativeNumber(item.carbs_g),
      fat_g: asNonNegativeNumber(item.fat_g),
      confidence,
      visual_confidence: visualConfidence,
      source: normalizeSource(item.source),
    };
  });
}

function mapOpenAIErrorMessage(text: string, locale: AnalyzeMealInput["locale"]) {
  const normalized = text.toLowerCase();
  if (normalized.includes("model") && (normalized.includes("not found") || normalized.includes("does not exist"))) {
    throw new AIConfigurationError(
      locale === "he"
        ? "מודל OpenAI לא זמין כרגע. בדקו את OPENAI_VISION_MODEL."
        : "The OpenAI model is not available right now. Check OPENAI_VISION_MODEL.",
    );
  }

  if (normalized.includes("api key") || normalized.includes("unauthorized") || normalized.includes("incorrect api key")) {
    throw new AIConfigurationError(
      locale === "he"
        ? "מפתח OpenAI חסר או לא תקין. בדקו את OPENAI_API_KEY."
        : "The OpenAI API key is missing or invalid. Check OPENAI_API_KEY.",
    );
  }

  return locale === "he"
    ? "ניתוח התמונה ב-OpenAI נכשל כרגע. נסו שוב בעוד רגע."
    : "OpenAI image analysis failed right now. Please try again in a moment.";
}

export class OpenAIProvider extends BaseAIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly textModel: string,
    private readonly visionModel: string,
  ) {
    super();
  }

  private async requestCompletion(payload: Record<string, unknown>, locale: AnalyzeMealInput["locale"]) {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(mapOpenAIErrorMessage(text, locale));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error(locale === "he" ? "OpenAI החזיר תשובה ריקה." : "OpenAI returned empty content.");
    }
    return raw;
  }

  private parseAnalysis(raw: string, input: AnalyzeMealInput) {
    const parsed = asRecord(JSON.parse(this.cleanJsonFence(raw)));
    const items = normalizeItems(parsed.items, input.locale);
    const fallbackTotal = items.reduce((sum, item) => sum + item.estimated_calories, 0);
    const containsFood = parseBooleanOrUndefined(parsed.contains_food) ?? parseBooleanOrUndefined(parsed.is_food) ?? items.length > 0;

    return analysisResultSchema.parse({
      items: containsFood ? items : [],
      total_estimated_calories: containsFood ? Math.round(asNonNegativeNumber(parsed.total_estimated_calories) ?? fallbackTotal) : 0,
      confidence: normalizeConfidence(parsed.confidence),
      is_food: containsFood,
      contains_food: containsFood,
      non_food_reason: containsFood
        ? undefined
        : asNonEmptyString(
            parsed.non_food_reason,
            input.locale === "he"
              ? "לא זוהה מזון בתמונה. נסו להעלות תמונה ברורה יותר."
              : "No food was detected in this image. Please upload a clearer meal image.",
          ),
      follow_up_questions: normalizeStringArray(parsed.follow_up_questions).slice(0, 3),
      notes: normalizeStringArray(parsed.notes),
    });
  }

  async analyzeMeal(input: AnalyzeMealInput) {
    const imageSource = input.imageUrl ?? input.imageBase64;
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: mealAnalysisSystemPrompt(input.locale) },
      imageSource
        ? {
            role: "user",
            content: [
              { type: "text", text: buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale) },
              { type: "image_url", image_url: { url: imageSource } },
            ],
          }
        : {
            role: "user",
            content: buildAnalysisUserPrompt(undefined, input.mealDescription, input.locale),
          },
    ];

    const candidates = imageSource
      ? uniqueModels([this.visionModel], FALLBACK_OPENAI_MODELS)
      : uniqueModels([this.textModel], FALLBACK_OPENAI_MODELS);

    let lastError: Error | null = null;
    for (const model of candidates) {
      try {
        const raw = await this.requestCompletion(
          {
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages,
          },
          input.locale,
        );
        return this.parseAnalysis(raw, input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown OpenAI error");
      }
    }

    throw lastError ?? new AIConfigurationError(input.locale === "he" ? "OpenAI לא זמין." : "OpenAI is not available.");
  }

  async chat(input: ChatInput) {
    const candidates = uniqueModels([this.textModel], FALLBACK_OPENAI_MODELS);
    let lastError: Error | null = null;

    for (const model of candidates) {
      try {
        const raw = await this.requestCompletion(
          {
            model,
            temperature: 0.2,
            messages: [
              { role: "system", content: chatSystemPrompt(input.locale, input.analysisContext) },
              ...input.messages,
            ],
          },
          input.locale,
        );
        return raw.trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown OpenAI chat error");
      }
    }

    throw lastError ?? new AIConfigurationError(input.locale === "he" ? "OpenAI לא זמין." : "OpenAI is not available.");
  }
}
