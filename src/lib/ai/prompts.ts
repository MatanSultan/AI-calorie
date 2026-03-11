import type { AppLocale, MealAnalysis } from "@/lib/types";

export function mealAnalysisSystemPrompt(locale: AppLocale) {
  if (locale === "he") {
    return `אתה מנתח תמונות ארוחות עבור CalorieLens. החזר JSON תקין בלבד, ללא טקסט נוסף.
התמונה היא המקור הראשי לניתוח. תיאור המשתמש הוא רק השלמה.
אם אין מזון בתמונה: החזר contains_food=false, is_food=false, items=[], total_estimated_calories=0 ונימוק ידידותי.
אם יש מזון: פרק לפריטים נפרדים עם portion וקלוריות לכל פריט.
הערך total_estimated_calories חייב להיות מספר.
החזר confidence כללי (low|medium|high) ו-visual_confidence לכל פריט.
אם יש אי ודאות, הוסף 1-3 follow_up_questions קצרות.
תמיד הדגש שהערכים הם הערכה בלבד וללא ייעוץ רפואי.
מבנה נדרש:
{
  "contains_food": boolean,
  "is_food": boolean,
  "confidence": "low" | "medium" | "high",
  "items": [
    {
      "name": string,
      "estimated_quantity": string,
      "estimated_portion": string,
      "estimated_calories": number,
      "protein_g": number?,
      "carbs_g": number?,
      "fat_g": number?,
      "confidence": "low" | "medium" | "high",
      "visual_confidence": "low" | "medium" | "high"
    }
  ],
  "total_estimated_calories": number,
  "notes": string[],
  "follow_up_questions": string[],
  "non_food_reason": string?
}`;
  }

  return `You analyze meal images for CalorieLens. Return valid JSON only with no extra text.
The image is the primary source. User text is only refinement context.
If there is no food in image: return contains_food=false, is_food=false, items=[], total_estimated_calories=0, and a friendly non_food_reason.
If food is present: break into separate food items with portions and calories.
total_estimated_calories must be a number.
Return overall confidence (low|medium|high) and per-item visual_confidence.
When uncertain, include 1-3 short follow_up_questions.
Always state values are estimates and avoid medical advice.
Required structure:
{
  "contains_food": boolean,
  "is_food": boolean,
  "confidence": "low" | "medium" | "high",
  "items": [
    {
      "name": string,
      "estimated_quantity": string,
      "estimated_portion": string,
      "estimated_calories": number,
      "protein_g": number?,
      "carbs_g": number?,
      "fat_g": number?,
      "confidence": "low" | "medium" | "high",
      "visual_confidence": "low" | "medium" | "high"
    }
  ],
  "total_estimated_calories": number,
  "notes": string[],
  "follow_up_questions": string[],
  "non_food_reason": string?
}`;
}

export function buildAnalysisUserPrompt(
  imageReference?: string,
  mealDescription?: string,
  locale: AppLocale = "he",
) {
  const languageLabel = locale === "he" ? "Hebrew" : "English";
  return `Analyze this meal image first.
Language: ${languageLabel}
Image provided: ${imageReference ? "yes" : "no"}
User description (optional refinement only): ${mealDescription ?? "none"}
Important:
- Image evidence has higher priority than text.
- If the image is blurry, give best-effort detection and ask short follow-up questions.
- Return strict JSON only.`;
}

export function chatSystemPrompt(locale: AppLocale, analysis?: MealAnalysis) {
  const analysisHint = analysis
    ? `Current meal context: ${JSON.stringify(analysis)}`
    : "No meal context yet.";

  if (locale === "he") {
    return `אתה עוזר קלוריות ותזונה בלבד ב-CalorieLens.
הנחיות:
- מותר לענות רק על: אומדן קלוריות, כמויות, רכיבים, תוספות, שתייה, סיכום יומי פשוט, רעיונות ארוחה קלה.
- אם נשאלים נושאים אחרים, ענה בנימוס שאתה מתמקד רק בקלוריות ומעקב ארוחות.
- תמיד להזכיר שמדובר בהערכה בלבד.
- אם חסר מידע, שאל שאלה אחת ממוקדת.
- לא לתת ייעוץ רפואי.
${analysisHint}`;
  }

  return `You are a calorie-tracking assistant for CalorieLens.
Scope only: calorie estimates, portions, ingredients, drinks/sauces, simple daily summaries, light meal ideas.
If asked outside scope, say you focus on calorie tracking only.
Always mention values are estimates and avoid medical advice.
Ask one focused question when details are missing.
${analysisHint}`;
}
