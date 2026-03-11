import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { buildAnalysisUserPrompt, chatSystemPrompt, mealAnalysisSystemPrompt } from "@/lib/ai/prompts";
import { AIConfigurationError } from "@/lib/ai/errors";
import type { Confidence } from "@/lib/types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const FALLBACK_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const FALLBACK_TEXT_MODELS = [
  "llama-3.3-70b-versatile",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

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

function normalizeItems(items: unknown, locale: AnalyzeMealInput["locale"]) {
  if (!Array.isArray(items)) return [];

  return items.map((entry, index) => {
    const item = asRecord(entry);
    const visualConfidence = normalizeConfidence(item.visual_confidence ?? item.confidence);
    const confidence = normalizeConfidence(item.confidence ?? item.visual_confidence);
    const portion = asNonEmptyString(
      item.estimated_portion ?? item.estimated_quantity,
      locale === "he" ? "מנה אחת" : "1 serving",
    );
    const protein = asNonNegativeNumber(item.protein_g);
    const carbs = asNonNegativeNumber(item.carbs_g);
    const fat = asNonNegativeNumber(item.fat_g);

    return {
      name: asNonEmptyString(item.name, locale === "he" ? `פריט ${index + 1}` : `Item ${index + 1}`),
      estimated_quantity: portion,
      estimated_portion: portion,
      estimated_calories: Math.round(asNonNegativeNumber(item.estimated_calories) ?? 0),
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      confidence,
      visual_confidence: visualConfidence,
      source: normalizeSource(item.source),
    };
  });
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

function buildNotes(locale: AnalyzeMealInput["locale"], rawNotes: unknown, containsFood: boolean, imageProvided: boolean) {
  const base = normalizeStringArray(rawNotes);
  const estimateOnly =
    locale === "he" ? "הערכים הם הערכה בלבד ואינם ייעוץ רפואי." : "Values are estimates only and not medical advice.";
  const imagePrimary =
    locale === "he"
      ? "ההערכה התבססה בעיקר על ניתוח חזותי של התמונה."
      : "The estimate was generated primarily from visual image analysis.";
  const unclearImage =
    locale === "he"
      ? "אם הזיהוי לא מדויק, אפשר לעדכן כמויות לפני שמירה."
      : "If detection is not precise, you can edit quantities before saving.";

  const notes = [...base];
  if (!notes.some((line) => line.includes("הערכה") || /estimate/i.test(line))) {
    notes.unshift(estimateOnly);
  }
  if (imageProvided && containsFood && !notes.some((line) => line.includes("חזותי") || /visual/i.test(line))) {
    notes.push(imagePrimary);
  }
  if (containsFood && !notes.some((line) => line.includes("לעדכן") || /edit/i.test(line))) {
    notes.push(unclearImage);
  }
  return notes.slice(0, 6);
}

function mapGroqErrorMessage(text: string, locale: AnalyzeMealInput["locale"]) {
  const normalized = text.toLowerCase();

  if (normalized.includes("blocked at the project level") || normalized.includes("model_permission_blocked_project")) {
    throw new AIConfigurationError(
      locale === "he"
        ? "מודל הוויז'ן של Groq חסום בפרויקט. הפעילו מודל ויז'ן ב-Groq או הוסיפו OPENAI_API_KEY."
        : "The Groq vision model is blocked for this project. Enable a Groq vision model or add OPENAI_API_KEY.",
    );
  }

  if ((normalized.includes("image") || normalized.includes("base64")) && (normalized.includes("4mb") || normalized.includes("too large") || normalized.includes("exceed"))) {
    return locale === "he"
      ? "התמונה גדולה מדי לניתוח AI. נסו להעלות תמונה קטנה או ברורה יותר."
      : "The image is too large for AI analysis. Please upload a smaller or clearer meal photo.";
  }

  if (normalized.includes("model") && (normalized.includes("not found") || normalized.includes("does not exist") || normalized.includes("unsupported"))) {
    throw new AIConfigurationError(
      locale === "he"
        ? "מודל הוויז'ן של Groq אינו זמין כרגע בפרויקט."
        : "The Groq vision model is not available for this project.",
    );
  }

  if (normalized.includes("api key") || normalized.includes("unauthorized") || normalized.includes("invalid api key")) {
    throw new AIConfigurationError(
      locale === "he"
        ? "מפתח Groq חסר או לא תקין. בדקו את GROQ_API_KEY."
        : "The Groq API key is missing or invalid. Check GROQ_API_KEY.",
    );
  }

  return locale === "he"
    ? "ניתוח התמונה נכשל כרגע. נסו שוב עם תמונה ברורה יותר."
    : "Image analysis failed right now. Please try again with a clearer meal image.";
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
      throw new Error("Groq returned empty content");
    }
    return raw;
  }

  private parseAnalysis(
    raw: string,
    input: AnalyzeMealInput,
    imageProvided: boolean,
  ) {
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
    const isFood = containsFood;
    const followUpQuestions = normalizeStringArray(parsed.follow_up_questions).slice(0, 3);
    const requestedConfidence = normalizeConfidence(parsed.confidence);
    const confidence = computeOverallConfidence(normalizedItems, requestedConfidence);
    const nonFoodReason = !containsFood
      ? asNonEmptyString(
          parsed.non_food_reason,
          input.locale === "he"
            ? "לא הצלחנו לזהות אוכל בתמונה, נסו להעלות תמונת ארוחה ברורה יותר."
            : "We could not detect food in this image. Please upload a clearer meal image.",
        )
      : undefined;
    const notes = buildNotes(input.locale, parsed.notes, containsFood, imageProvided);

    const candidate = analysisResultSchema.safeParse({
      items: containsFood ? normalizedItems : [],
      total_estimated_calories: containsFood ? Math.round(explicitTotal ?? fallbackTotal) : 0,
      confidence,
      is_food: isFood,
      contains_food: containsFood,
      non_food_reason: nonFoodReason,
      follow_up_questions: followUpQuestions,
      notes,
    });

    if (!candidate.success) return null;
    return candidate.data;
  }

  async analyzeMeal(input: AnalyzeMealInput) {
    const imageSource = input.imageUrl ?? input.imageBase64;
    const imageProvided = Boolean(imageSource);

    const baseMessages: Array<Record<string, unknown>> = [
      {
        role: "system",
        content: mealAnalysisSystemPrompt(input.locale),
      },
    ];

    if (imageSource) {
      baseMessages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: buildAnalysisUserPrompt(imageSource, input.mealDescription, input.locale),
          },
          {
            type: "image_url",
            image_url: { url: imageSource },
          },
        ],
      });
    } else {
      baseMessages.push({
        role: "user",
        content: buildAnalysisUserPrompt(undefined, input.mealDescription, input.locale),
      });
    }

    const modelCandidates = imageSource
      ? uniqueModels([this.visionModel], FALLBACK_VISION_MODELS)
      : uniqueModels([this.textModel], FALLBACK_TEXT_MODELS);

    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const messages =
            attempt === 0
              ? baseMessages
              : [
                  ...baseMessages,
                  {
                    role: "user",
                    content:
                      input.locale === "he"
                        ? "התגובה הקודמת לא הייתה JSON תקין. החזר JSON תקין בלבד לפי הסכמה."
                        : "Previous output was malformed. Return strict valid JSON only following the required schema.",
                  },
                ];

          const raw = await this.requestCompletion({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages,
          }, input.locale);

          const parsed = this.parseAnalysis(raw, input, imageProvided);
          if (parsed) return parsed;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("Unknown analyze error");
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error(input.locale === "he" ? "לא התקבלה תשובת ניתוח תקינה." : "No valid analysis response was returned.");
  }

  async chat(input: ChatInput) {
    const modelCandidates = uniqueModels([this.textModel], FALLBACK_TEXT_MODELS);
    let lastError: Error | null = null;

    for (const model of modelCandidates) {
      try {
        const raw = await this.requestCompletion({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: chatSystemPrompt(input.locale, input.analysisContext),
            },
            ...input.messages,
          ],
        }, input.locale);
        return raw.trim();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown chat error");
      }
    }

    throw lastError ?? new Error("Chat failed");
  }
}
