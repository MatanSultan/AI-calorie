import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";

type FoodSeed = {
  keywords: string[];
  name: { he: string; en: string };
  portion: { he: string; en: string };
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

const FOOD_SEEDS: FoodSeed[] = [
  {
    keywords: ["rice", "אורז"],
    name: { he: "אורז", en: "Rice" },
    portion: { he: "כוס מבושלת", en: "1 cooked cup" },
    calories: 210,
    protein_g: 4,
    carbs_g: 45,
    fat_g: 1,
  },
  {
    keywords: ["chicken", "עוף", "שניצל"],
    name: { he: "עוף", en: "Chicken" },
    portion: { he: "150 גרם", en: "150 g" },
    calories: 250,
    protein_g: 31,
    carbs_g: 0,
    fat_g: 12,
  },
  {
    keywords: ["salad", "סלט"],
    name: { he: "סלט", en: "Salad" },
    portion: { he: "קערה בינונית", en: "1 medium bowl" },
    calories: 90,
    protein_g: 2,
    carbs_g: 10,
    fat_g: 5,
  },
  {
    keywords: ["pasta", "פסטה"],
    name: { he: "פסטה", en: "Pasta" },
    portion: { he: "צלחת בינונית", en: "1 medium plate" },
    calories: 420,
    protein_g: 14,
    carbs_g: 68,
    fat_g: 10,
  },
  {
    keywords: ["potato", "fries", "צ'יפס", "תפוח אדמה"],
    name: { he: "תפוחי אדמה", en: "Potatoes" },
    portion: { he: "מנה בינונית", en: "1 medium portion" },
    calories: 230,
    protein_g: 4,
    carbs_g: 36,
    fat_g: 8,
  },
  {
    keywords: ["bread", "toast", "sandwich", "לחם", "טוסט", "כריך"],
    name: { he: "לחם או כריך", en: "Bread or sandwich" },
    portion: { he: "מנה אחת", en: "1 serving" },
    calories: 260,
    protein_g: 10,
    carbs_g: 34,
    fat_g: 9,
  },
  {
    keywords: ["burger", "המבורגר"],
    name: { he: "המבורגר", en: "Burger" },
    portion: { he: "כריך אחד", en: "1 burger" },
    calories: 520,
    protein_g: 28,
    carbs_g: 39,
    fat_g: 28,
  },
  {
    keywords: ["shawarma", "שווארמה"],
    name: { he: "שווארמה", en: "Shawarma" },
    portion: { he: "מנה אחת", en: "1 serving" },
    calories: 540,
    protein_g: 32,
    carbs_g: 28,
    fat_g: 32,
  },
  {
    keywords: ["pizza", "פיצה"],
    name: { he: "פיצה", en: "Pizza" },
    portion: { he: "2 משולשים", en: "2 slices" },
    calories: 420,
    protein_g: 17,
    carbs_g: 43,
    fat_g: 20,
  },
  {
    keywords: ["egg", "eggs", "ביצה", "ביצים"],
    name: { he: "ביצים", en: "Eggs" },
    portion: { he: "2 ביצים", en: "2 eggs" },
    calories: 160,
    protein_g: 13,
    carbs_g: 1,
    fat_g: 11,
  },
  {
    keywords: ["juice", "soda", "cola", "מיץ", "שתייה", "קולה"],
    name: { he: "שתייה", en: "Drink" },
    portion: { he: "כוס אחת", en: "1 cup" },
    calories: 120,
    protein_g: 0,
    carbs_g: 30,
    fat_g: 0,
  },
];

function label(locale: AnalyzeMealInput["locale"], he: string, en: string) {
  return locale === "he" ? he : en;
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function buildItemsFromDescription(input: AnalyzeMealInput) {
  const text = normalizeText(input.mealDescription);
  const matches = FOOD_SEEDS.filter((seed) => seed.keywords.some((keyword) => text.includes(keyword))).slice(0, 5);

  if (matches.length === 0) {
    if (input.imageBase64 || input.imageUrl) {
      return [
        {
          name: label(input.locale, "ארוחה מעורבת מהתמונה", "Mixed meal from image"),
          estimated_quantity: label(input.locale, "מנה אחת", "1 serving"),
          estimated_portion: label(input.locale, "מנה אחת", "1 serving"),
          estimated_calories: 430,
          confidence: "low" as const,
          visual_confidence: "low" as const,
          source: "ai_estimate" as const,
        },
      ];
    }

    return [
      {
        name: label(input.locale, "ארוחה כללית", "General meal"),
        estimated_quantity: label(input.locale, "מנה בינונית", "1 medium serving"),
        estimated_portion: label(input.locale, "מנה בינונית", "1 medium serving"),
        estimated_calories: 380,
        confidence: "low" as const,
        visual_confidence: "low" as const,
        source: "ai_estimate" as const,
      },
    ];
  }

  return matches.map((seed) => ({
    name: seed.name[input.locale],
    estimated_quantity: seed.portion[input.locale],
    estimated_portion: seed.portion[input.locale],
    estimated_calories: seed.calories,
    protein_g: seed.protein_g,
    carbs_g: seed.carbs_g,
    fat_g: seed.fat_g,
    confidence: matches.length > 1 ? ("medium" as const) : ("low" as const),
    visual_confidence: input.imageBase64 || input.imageUrl ? ("medium" as const) : ("low" as const),
    source: "ai_estimate" as const,
  }));
}

export class MockAIProvider extends BaseAIProvider {
  async analyzeMeal(input: AnalyzeMealInput) {
    const text = normalizeText(input.mealDescription);
    const likelyNonFood = ["car", "book", "laptop", "dog", "cat", "table", "chair", "מחשב", "רכב", "ספר"].some((word) =>
      text.includes(word),
    );

    if (likelyNonFood) {
      return analysisResultSchema.parse({
        items: [],
        total_estimated_calories: 0,
        confidence: "high",
        contains_food: false,
        is_food: false,
        non_food_reason: label(
          input.locale,
          "נראה שהתמונה או התיאור אינם מציגים מזון.",
          "The image or description does not appear to show food.",
        ),
        follow_up_questions: [],
        notes: [
          label(
            input.locale,
            "לא זוהה מזון. נסו להעלות תמונת ארוחה ברורה יותר.",
            "No food was detected. Please upload a clearer meal image.",
          ),
        ],
      });
    }

    const items = buildItemsFromDescription(input);
    const total = items.reduce((sum, item) => sum + item.estimated_calories, 0);
    const lowConfidence = items.some((item) => item.confidence === "low");

    return analysisResultSchema.parse({
      items,
      total_estimated_calories: total,
      confidence: lowConfidence ? "low" : "medium",
      contains_food: true,
      is_food: true,
      follow_up_questions: [
        label(input.locale, "מה הייתה בערך הכמות הכוללת?", "What was the rough portion size?"),
        label(input.locale, "היה רוטב, שמן או גבינה?", "Was there sauce, oil, or cheese?"),
        label(input.locale, "הייתה גם שתייה או תוספת בצד?", "Was there also a drink or side?"),
      ],
      notes: [
        label(
          input.locale,
          "מודל הוויז'ן החי לא היה זמין, לכן זו הערכת גיבוי שדורשת בדיקה ידנית.",
          "The live vision model was unavailable, so this is a fallback estimate that should be reviewed.",
        ),
      ],
    });
  }

  async chat(input: ChatInput) {
    const latestUserMessage =
      [...input.messages].reverse().find((message) => message.role === "user")?.content.trim() ??
      label(input.locale, "יש לי שאלה על הארוחה", "I have a question about the meal");

    return label(
      input.locale,
      `קיבלתי: "${latestUserMessage}". זאת רק הערכת גיבוי, לכן כדאי לעדכן ידנית אם משהו בתמונה לא מדויק.`,
      `I noted: "${latestUserMessage}". This is only a fallback estimate, so please edit manually if anything looks off.`,
    );
  }
}
