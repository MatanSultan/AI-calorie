import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { buildAnalysisUserPrompt, chatSystemPrompt, mealAnalysisSystemPrompt } from "@/lib/ai/prompts";
import { AIConfigurationError } from "@/lib/ai/errors";
import type { Confidence } from "@/lib/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MAX_COMPLETION_TOKENS = 1400;
const FALLBACK_OPENAI_MODELS = ["gpt-4.1-mini", "gpt-4o-mini"];

const GENERIC_ITEM_NAMES = new Set([
  "mixed meal",
  "meal",
  "dish",
  "plate",
  "main dish",
  "general meal",
]);

function t(locale: AnalyzeMealInput["locale"], he: string, en: string) {
  return locale === "he" ? he : en;
}

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
  const normalized = typeof value === "string" ? value.toLowerCase().trim() : "";
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

function computeOverallConfidence(items: Array<{ confidence: Confidence }>, fallback: Confidence = "medium"): Confidence {
  if (items.length === 0) return fallback;
  const counts = { low: 0, medium: 0, high: 0 };
  items.forEach((item) => {
    counts[item.confidence] += 1;
  });
  if (counts.low >= Math.ceil(items.length / 2)) return "low";
  if (counts.high >= Math.ceil(items.length / 2)) return "high";
  return "medium";
}

function isGenericCatchallName(name: string) {
  return GENERIC_ITEM_NAMES.has(name.trim().toLowerCase());
}

function normalizeItems(items: unknown, locale: AnalyzeMealInput["locale"]) {
  if (!Array.isArray(items)) return [];

  const normalized = items.map((entry, index) => {
    const item = asRecord(entry);
    const portion = asNonEmptyString(item.estimated_portion ?? item.estimated_quantity, t(locale, "מנה אחת", "1 serving"));
    const confidence = normalizeConfidence(item.confidence ?? item.visual_confidence);
    const visualConfidence = normalizeConfidence(item.visual_confidence ?? item.confidence);

    return {
      name: asNonEmptyString(item.name, `Item ${index + 1}`),
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

  if (normalized.length > 1) {
    return normalized.filter((item) => !isGenericCatchallName(item.name));
  }

  return normalized;
}

function buildNotes(locale: AnalyzeMealInput["locale"], rawNotes: unknown, imageProvided: boolean) {
  const notes = [...normalizeStringArray(rawNotes)];
  const estimateNote = t(locale, "הערכים הם הערכה בלבד.", "Values are estimates only.");
  const imageNote = t(locale, "ההערכה מבוססת על ניתוח התמונה.", "Values are estimates based on image analysis.");

  if (!notes.some((note) => /estimate|הערכ/i.test(note))) {
    notes.unshift(estimateNote);
  }

  if (imageProvided && !notes.some((note) => /image analysis|תמונה/i.test(note))) {
    notes.push(imageNote);
  }

  return notes.slice(0, 4);
}

function mapOpenAIError(text: string, locale: AnalyzeMealInput["locale"]) {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("model") &&
    (normalized.includes("not found") || normalized.includes("does not exist") || normalized.includes("unsupported"))
  ) {
    throw new AIConfigurationError(
      t(
        locale,
        "מודל הוויז'ן של OpenAI לא זמין. בדקו את OPENAI_VISION_MODEL.",
        "The configured OpenAI vision model is not available. Check OPENAI_VISION_MODEL.",
      ),
    );
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("incorrect api key") ||
    normalized.includes("invalid_api_key")
  ) {
    throw new AIConfigurationError(
      t(
        locale,
        "מפתח OpenAI חסר או לא תקין. בדקו את OPENAI_API_KEY.",
        "The OpenAI API key is missing or invalid. Check OPENAI_API_KEY.",
      ),
    );
  }

  if (normalized.includes("image") && (normalized.includes("too large") || normalized.includes("invalid image"))) {
    return t(
      locale,
      "התמונה לא תקינה לניתוח AI. נסו תמונה קטנה או ברורה יותר.",
      "The image could not be processed. Try a smaller or clearer image.",
    );
  }

  if (normalized.includes("rate limit")) {
    return t(
      locale,
      "OpenAI עמוס כרגע. נסו שוב בעוד רגע.",
      "OpenAI is rate-limited right now. Please try again in a moment.",
    );
  }

  return t(
    locale,
    "ניתוח התמונה ב-OpenAI נכשל כרגע.",
    "OpenAI image analysis failed right now.",
  );
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
      throw new Error(mapOpenAIError(text, locale));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error(t(locale, "OpenAI החזיר תשובה ריקה.", "OpenAI returned empty content."));
    }

    return raw;
  }

  private parseAnalysis(raw: string, input: AnalyzeMealInput, imageProvided: boolean) {
    let parsed = {} as Record<string, unknown>;
    try {
      parsed = asRecord(JSON.parse(this.cleanJsonFence(raw)));
    } catch {
      return null;
    }

    const normalizedItems = normalizeItems(parsed.items, input.locale);
    const fallbackTotal = normalizedItems.reduce((sum, item) => sum + item.estimated_calories, 0);
    const explicitTotal = asNonNegativeNumber(parsed.total_estimated_calories);
    const explicitContainsFood = parseBooleanOrUndefined(parsed.contains_food);
    const explicitIsFood = parseBooleanOrUndefined(parsed.is_food);
    const inferredContainsFood = normalizedItems.length > 0 || fallbackTotal > 0;
    const containsFood = explicitContainsFood ?? explicitIsFood ?? inferredContainsFood;
    const followUpQuestions = containsFood ? normalizeStringArray(parsed.follow_up_questions).slice(0, 3) : [];
    const confidence = computeOverallConfidence(normalizedItems, normalizeConfidence(parsed.confidence));

    const candidate = analysisResultSchema.safeParse({
      items: containsFood ? normalizedItems : [],
      total_estimated_calories: containsFood ? Math.round(explicitTotal ?? fallbackTotal) : 0,
      confidence,
      is_food: containsFood,
      contains_food: containsFood,
      non_food_reason: !containsFood
        ? asNonEmptyString(
            parsed.non_food_reason,
            t(
              input.locale,
              "לא זוהה מזון בתמונה. נסו להעלות תמונת ארוחה ברורה יותר.",
              "No food was detected in this image. Please upload a clearer meal image.",
            ),
          )
        : undefined,
      follow_up_questions: followUpQuestions,
      notes: buildNotes(input.locale, parsed.notes, imageProvided),
    });

    if (!candidate.success) return null;
    return candidate.data;
  }

  async analyzeMeal(input: AnalyzeMealInput) {
    const imageSource = input.imageUrl ?? input.imageBase64;
    const imageProvided = Boolean(imageSource);
    const modelCandidates = imageProvided
      ? uniqueModels([this.visionModel], FALLBACK_OPENAI_MODELS)
      : uniqueModels([this.textModel], FALLBACK_OPENAI_MODELS);

    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const messages: Array<Record<string, unknown>> = [
            { role: "system", content: mealAnalysisSystemPrompt(input.locale) },
            imageSource
              ? {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text:
                        attempt === 0
                          ? buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale)
                          : `${buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale)}\nReturn corrected strict JSON only.`,
                    },
                    { type: "image_url", image_url: { url: imageSource } },
                  ],
                }
              : {
                  role: "user",
                  content:
                    attempt === 0
                      ? buildAnalysisUserPrompt(undefined, input.mealDescription, input.locale)
                      : `${buildAnalysisUserPrompt(undefined, input.mealDescription, input.locale)}\nReturn corrected strict JSON only.`,
                },
          ];

          const raw = await this.requestCompletion(
            {
              model,
              temperature: 0.1,
              max_completion_tokens: MAX_COMPLETION_TOKENS,
              response_format: { type: "json_object" },
              messages,
            },
            input.locale,
          );

          const parsed = this.parseAnalysis(raw, input, imageProvided);
          if (parsed) return parsed;
          lastError = new Error("OpenAI returned malformed JSON analysis.");
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Unknown OpenAI analyze error");
        }
      }
    }

    throw lastError ?? new AIConfigurationError(t(input.locale, "OpenAI לא זמין.", "OpenAI is not available."));
  }

  async chat(input: ChatInput) {
    const modelCandidates = uniqueModels([this.textModel], FALLBACK_OPENAI_MODELS);
    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      try {
        const raw = await this.requestCompletion(
          {
            model,
            temperature: 0.2,
            max_completion_tokens: 700,
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

    throw lastError ?? new AIConfigurationError(t(input.locale, "OpenAI לא זמין.", "OpenAI is not available."));
  }
}
