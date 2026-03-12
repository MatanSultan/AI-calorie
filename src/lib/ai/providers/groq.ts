import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { buildAnalysisUserPrompt, chatSystemPrompt, mealAnalysisSystemPrompt } from "@/lib/ai/prompts";
import { AIConfigurationError } from "@/lib/ai/errors";
import type { Confidence } from "@/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_COMPLETION_TOKENS = 1400;

const SUPPORTED_GROQ_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const FALLBACK_TEXT_MODELS = [
  "llama-3.3-70b-versatile",
];

const GENERIC_ITEM_NAMES = new Set([
  "mixed meal",
  "meal",
  "dish",
  "plate",
  "main dish",
  "general meal",
  "ארוחה",
  "ארוחה מעורבת",
  "מנה",
  "מנה מעורבת",
  "מנה עיקרית",
  "צלחת",
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
    const visualConfidence = normalizeConfidence(item.visual_confidence ?? item.confidence);
    const confidence = normalizeConfidence(item.confidence ?? item.visual_confidence);
    const portion = asNonEmptyString(
      item.estimated_portion ?? item.estimated_quantity,
      t(locale, "מנה אחת", "1 serving"),
    );

    return {
      name: asNonEmptyString(item.name, t(locale, `פריט ${index + 1}`, `Item ${index + 1}`)),
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

function parseBooleanOrUndefined(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function buildNotes(locale: AnalyzeMealInput["locale"], rawNotes: unknown, imageProvided: boolean) {
  const base = normalizeStringArray(rawNotes);
  const estimateOnly = t(locale, "הערכים הם הערכה בלבד ואינם ייעוץ רפואי.", "Values are estimates only and not medical advice.");
  const imagePrimary = t(
    locale,
    "ההערכה מבוססת בעיקר על ניתוח חזותי של התמונה.",
    "Values are estimates based on image analysis.",
  );

  const notes = [...base];
  if (!notes.some((line) => /estimate|הערכ/i.test(line))) {
    notes.unshift(estimateOnly);
  }
  if (imageProvided && !notes.some((line) => /image analysis|ניתוח חזותי/i.test(line))) {
    notes.push(imagePrimary);
  }
  return notes.slice(0, 4);
}

function mapGroqErrorMessage(text: string, locale: AnalyzeMealInput["locale"]) {
  const normalized = text.toLowerCase();

  if (normalized.includes("model_decommissioned") || normalized.includes("decommissioned")) {
    throw new AIConfigurationError(
      t(
        locale,
        "מודל הוויז'ן של Groq שהוגדר הוסר משימוש. עדכנו את GROQ_VISION_MODEL למודל נתמך, למשל meta-llama/llama-4-scout-17b-16e-instruct.",
        "The configured Groq vision model has been decommissioned. Update GROQ_VISION_MODEL to a supported model such as meta-llama/llama-4-scout-17b-16e-instruct.",
      ),
    );
  }

  if (normalized.includes("blocked at the project level") || normalized.includes("model_permission_blocked_project")) {
    throw new AIConfigurationError(
      t(
        locale,
        "מודל הוויז'ן של Groq חסום ברמת הפרויקט. מנהל הפרויקט צריך לאפשר את המודל בהגדרות הפרויקט, או להגדיר OPENAI_API_KEY.",
        "The Groq vision model is blocked at the project level. A project admin must enable it in Groq project settings, or you must configure OPENAI_API_KEY.",
      ),
    );
  }

  if (
    normalized.includes("model") &&
    (normalized.includes("not found") || normalized.includes("does not exist") || normalized.includes("unsupported"))
  ) {
    throw new AIConfigurationError(
      t(
        locale,
        "מודל הוויז'ן של Groq אינו זמין לפרויקט הזה. הגדירו מודל נתמך או השתמשו ב-OpenAI.",
        "The Groq vision model is not available for this project. Configure a supported Groq model or use OpenAI instead.",
      ),
    );
  }

  if ((normalized.includes("image") || normalized.includes("base64")) && (normalized.includes("4mb") || normalized.includes("too large"))) {
    return t(
      locale,
      "התמונה גדולה מדי לניתוח AI. נסו תמונה קטנה או דחוסה יותר.",
      "The image is too large for AI analysis. Please try a smaller image.",
    );
  }

  if (normalized.includes("api key") || normalized.includes("unauthorized") || normalized.includes("invalid api key")) {
    throw new AIConfigurationError(
      t(
        locale,
        "מפתח Groq חסר או לא תקין. בדקו את GROQ_API_KEY.",
        "The Groq API key is missing or invalid. Check GROQ_API_KEY.",
      ),
    );
  }

  return t(
    locale,
    "קריאת הוויז'ן ל-Groq נכשלה כרגע.",
    "The Groq vision request failed.",
  );
}

export class GroqAIProvider extends BaseAIProvider {
  constructor(
    private readonly apiKey: string,
    private readonly textModel: string,
    private readonly visionModel: string,
  ) {
    super();
  }

  private async requestCompletion(payload: Record<string, unknown>, locale: AnalyzeMealInput["locale"]) {
    const response = await fetch(GROQ_URL, {
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
      throw new Error(mapGroqErrorMessage(text, locale));
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      throw new Error("Groq returned empty content.");
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
    const followUpQuestions = normalizeStringArray(parsed.follow_up_questions).slice(0, 3);
    const requestedConfidence = normalizeConfidence(parsed.confidence);
    const confidence = computeOverallConfidence(normalizedItems, requestedConfidence);
    const nonFoodReason = !containsFood
      ? asNonEmptyString(
          parsed.non_food_reason,
          t(
            input.locale,
            "לא זוהה מזון בתמונה. נסו תמונה ברורה יותר.",
            "No food was detected in this image. Please upload a clearer meal image.",
          ),
        )
      : undefined;

    const candidate = analysisResultSchema.safeParse({
      items: containsFood ? normalizedItems : [],
      total_estimated_calories: containsFood ? Math.round(explicitTotal ?? fallbackTotal) : 0,
      confidence,
      is_food: containsFood,
      contains_food: containsFood,
      non_food_reason: nonFoodReason,
      follow_up_questions: containsFood ? followUpQuestions : [],
      notes: buildNotes(input.locale, parsed.notes, imageProvided),
    });

    if (!candidate.success) return null;
    return candidate.data;
  }

  async analyzeMeal(input: AnalyzeMealInput) {
    const imageSource = input.imageUrl ?? input.imageBase64;
    const imageProvided = Boolean(imageSource);

    if (!imageSource) {
      throw new AIConfigurationError(
        t(
          input.locale,
          "Groq vision דורש תמונה לניתוח.",
          "Groq vision requires an image input.",
        ),
      );
    }

    const modelCandidates = uniqueModels([this.visionModel], SUPPORTED_GROQ_VISION_MODELS);
    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const raw = await this.requestCompletion(
            {
              model,
              temperature: 0.1,
              max_completion_tokens: MAX_COMPLETION_TOKENS,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: mealAnalysisSystemPrompt(input.locale),
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "text",
                      text:
                        attempt === 0
                          ? buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale)
                          : `${buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale)}\nReturn corrected strict JSON only.`,
                    },
                    {
                      type: "image_url",
                      image_url: { url: imageSource },
                    },
                  ],
                },
              ],
            },
            input.locale,
          );

          const parsed = this.parseAnalysis(raw, input, imageProvided);
          if (parsed) return parsed;
          lastError = new Error("Groq returned malformed JSON analysis.");
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Unknown Groq analyze error");
        }
      }
    }

    throw lastError ?? new Error(t(input.locale, "לא התקבלה תשובת ניתוח תקינה מ-Groq.", "No valid Groq analysis response was returned."));
  }

  async chat(input: ChatInput) {
    const modelCandidates = uniqueModels([this.textModel], FALLBACK_TEXT_MODELS);
    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      try {
        const raw = await this.requestCompletion(
          {
            model,
            temperature: 0.2,
            max_completion_tokens: 700,
            messages: [
              {
                role: "system",
                content: chatSystemPrompt(input.locale, input.analysisContext),
              },
              ...input.messages,
            ],
          },
          input.locale,
        );
        return raw.trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown Groq chat error");
      }
    }

    throw lastError ?? new Error(t(input.locale, "הצ'אט מול Groq נכשל.", "Groq chat failed."));
  }
}
