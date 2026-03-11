import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";

export class MockAIProvider extends BaseAIProvider {
  async analyzeMeal(input: AnalyzeMealInput) {
    const text = input.mealDescription?.toLowerCase() ?? "";
    const likelyNonFood = ["car", "book", "laptop", "dog", "cat", "table", "chair"].some((word) =>
      text.includes(word),
    );

    if (likelyNonFood) {
      return analysisResultSchema.parse({
        items: [],
        total_estimated_calories: 0,
        confidence: "high",
        contains_food: false,
        is_food: false,
        non_food_reason:
          input.locale === "he"
            ? "נראה שהתמונה או התיאור אינם קשורים למזון."
            : "The image or description does not appear to be food.",
        follow_up_questions: [],
        notes:
          input.locale === "he"
            ? ["לא זוהה מזון. נסו להעלות תמונת ארוחה ברורה."]
            : ["No food detected. Please upload a clearer meal image."],
      });
    }

    const hasText = Boolean(input.mealDescription?.trim());
    const hasImage = Boolean(input.imageBase64 || input.imageUrl);
    const baseItems = hasText
      ? [
          {
            name: input.locale === "he" ? "ארוחה מעורבת" : "Mixed meal",
            estimated_quantity: input.locale === "he" ? "מנה בינונית" : "1 medium portion",
            estimated_portion: input.locale === "he" ? "מנה בינונית" : "1 medium portion",
            estimated_calories: 540,
            protein_g: 24,
            carbs_g: 58,
            fat_g: 22,
            confidence: "medium" as const,
            visual_confidence: "medium" as const,
            source: "ai_estimate" as const,
          },
        ]
      : [
          {
            name: input.locale === "he" ? "מנה עיקרית" : "Main dish",
            estimated_quantity: input.locale === "he" ? "מנה אחת" : "1 serving",
            estimated_portion: input.locale === "he" ? "מנה אחת" : "1 serving",
            estimated_calories: hasImage ? 390 : 350,
            confidence: hasImage ? ("medium" as const) : ("low" as const),
            visual_confidence: hasImage ? ("medium" as const) : ("low" as const),
            source: "ai_estimate" as const,
          },
        ];

    return analysisResultSchema.parse({
      items: baseItems,
      total_estimated_calories: baseItems.reduce((sum, item) => sum + item.estimated_calories, 0),
      confidence: hasImage ? "medium" : "low",
      contains_food: true,
      is_food: true,
      follow_up_questions:
        input.locale === "he"
          ? ["איך בושלה המנה?", "היו רטבים או שמן?", "הייתה גם שתייה לצד הארוחה?"]
          : ["How was it cooked?", "Any sauces or oil?", "Was there a drink with the meal?"],
      notes:
        input.locale === "he"
          ? [
              "מצב Mock: לא הוגדר מפתח API, מדובר בהערכה בלבד.",
              "ההערכה מבוססת בעיקר על קלט תמונה אם הועלה.",
            ]
          : [
              "Mock mode: API key missing, values are estimates only.",
              "Estimate is based primarily on image input when provided.",
            ],
    });
  }

  async chat(input: ChatInput) {
    if (input.locale === "he") {
      return `מעולה, עודכנתי. אני מתמקד רק במעקב קלוריות והארוחה הזו. כל הערכים הם הערכה בלבד. כדי לדייק: האם היה שימוש בשמן, רוטב או תוספת שתייה?`;
    }

    return `Great, noted. I focus only on calorie tracking for this meal. Values are estimates only. To refine: was there oil, sauce, or a drink with the meal?`;
  }
}

