import path from "node:path";
import { analysisResultSchema } from "@/lib/validation/meal";
import type { AnalyzeMealInput, ChatInput } from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AppLocale, Confidence, MealAnalysis, MealItemInput } from "@/lib/types";

type LocalizedText = {
  he: string;
  en: string;
};

type FoodCategory = "main" | "side" | "drink" | "dessert" | "generic";

type FoodProfile = {
  id: string;
  category: FoodCategory;
  labels: string[];
  name: LocalizedText;
  portion: LocalizedText;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  followUps: {
    he: string[];
    en: string[];
  };
};

type LabelScore = {
  label: string;
  score: number;
};

type LocalClassifier = (
  image: Blob,
  labels: string[],
  options?: Record<string, unknown>,
) => Promise<LabelScore[]>;

const LOCAL_VISION_MODEL = process.env.LOCAL_VISION_MODEL?.trim() || "Xenova/clip-vit-base-patch32";
const MIXED_MEAL_PROFILE_ID = "mixed-meal";
const LOCAL_VISION_CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || process.env.TEMP || process.cwd(),
  "CalorieLens",
  "transformers-cache",
);

const FOOD_PROFILES: FoodProfile[] = [
  {
    id: MIXED_MEAL_PROFILE_ID,
    category: "generic",
    labels: ["prepared meal", "cooked dish", "meal on a plate", "bowl of food", "plate of food"],
    name: { he: "ארוחה מעורבת", en: "Mixed meal" },
    portion: { he: "מנה בינונית", en: "1 medium plate" },
    calories: 520,
    protein_g: 22,
    carbs_g: 52,
    fat_g: 22,
    followUps: {
      he: ["האם הייתה גם תוספת או שתייה בצד?", "זו הייתה מנה אישית או גדולה?"],
      en: ["Was there a side or drink with it?", "Was this a regular or large portion?"],
    },
  },
  {
    id: "pasta",
    category: "main",
    labels: ["pasta", "spaghetti pasta", "penne pasta", "pasta with tomato sauce", "macaroni pasta"],
    name: { he: "פסטה", en: "Pasta" },
    portion: { he: "צלחת בינונית-גדולה", en: "1.5 cups" },
    calories: 430,
    protein_g: 14,
    carbs_g: 68,
    fat_g: 11,
    followUps: {
      he: ["היה רוטב עגבניות או שמנת?", "הייתה גם גבינה מעל?"],
      en: ["Was it tomato sauce or cream sauce?", "Was there cheese on top?"],
    },
  },
  {
    id: "pizza",
    category: "main",
    labels: ["pizza", "pizza slice", "cheese pizza", "pepperoni pizza"],
    name: { he: "פיצה", en: "Pizza" },
    portion: { he: "2 משולשים", en: "2 slices" },
    calories: 540,
    protein_g: 22,
    carbs_g: 58,
    fat_g: 24,
    followUps: {
      he: ["כמה משולשים אכלת?", "הייתה תוספת גבינה או תוספות נוספות?"],
      en: ["How many slices did you eat?", "Was there extra cheese or toppings?"],
    },
  },
  {
    id: "salad",
    category: "side",
    labels: ["salad", "vegetable salad", "greek salad", "caesar salad"],
    name: { he: "סלט", en: "Salad" },
    portion: { he: "קערה בינונית", en: "1 medium bowl" },
    calories: 210,
    protein_g: 6,
    carbs_g: 16,
    fat_g: 13,
    followUps: {
      he: ["היה רוטב או שמן בסלט?", "היו גם גבינה, קרוטונים או אגוזים?"],
      en: ["Was there dressing or oil?", "Did it include cheese, croutons, or nuts?"],
    },
  },
  {
    id: "rice",
    category: "side",
    labels: ["rice", "white rice", "rice bowl", "cooked rice"],
    name: { he: "אורז", en: "Rice" },
    portion: { he: "כוס אחת", en: "1 cup" },
    calories: 210,
    protein_g: 4,
    carbs_g: 45,
    fat_g: 1,
    followUps: {
      he: ["האורז היה עם שמן או חמאה?", "זו הייתה כוס אחת או יותר?"],
      en: ["Was the rice cooked with oil or butter?", "Was it about one cup or more?"],
    },
  },
  {
    id: "grilled-chicken",
    category: "main",
    labels: ["grilled chicken breast", "chicken breast", "grilled chicken", "roasted chicken"],
    name: { he: "חזה עוף", en: "Chicken breast" },
    portion: { he: "150 גרם", en: "150g" },
    calories: 250,
    protein_g: 32,
    carbs_g: 0,
    fat_g: 8,
    followUps: {
      he: ["העוף היה בגריל או מטוגן?", "היה גם רוטב או שמן מעל?"],
      en: ["Was the chicken grilled or fried?", "Was there sauce or oil added?"],
    },
  },
  {
    id: "fried-chicken",
    category: "main",
    labels: ["fried chicken", "crispy chicken", "breaded chicken"],
    name: { he: "עוף מטוגן", en: "Fried chicken" },
    portion: { he: "חתיכה בינונית", en: "1 medium piece" },
    calories: 320,
    protein_g: 24,
    carbs_g: 12,
    fat_g: 18,
    followUps: {
      he: ["כמה חתיכות היו?", "היה גם רוטב או תוספת בצד?"],
      en: ["How many pieces were there?", "Was there sauce or a side with it?"],
    },
  },
  {
    id: "burger",
    category: "main",
    labels: ["burger", "hamburger", "cheeseburger", "beef burger"],
    name: { he: "בורגר", en: "Burger" },
    portion: { he: "בורגר אחד", en: "1 burger" },
    calories: 590,
    protein_g: 29,
    carbs_g: 40,
    fat_g: 33,
    followUps: {
      he: ["היה גם צ'יפס או שתייה בצד?", "הבורגר היה עם גבינה או רטבים מיוחדים?"],
      en: ["Was there fries or a drink with it?", "Did the burger include cheese or extra sauces?"],
    },
  },
  {
    id: "sandwich",
    category: "main",
    labels: ["sandwich", "toast sandwich", "bagel sandwich", "panini"],
    name: { he: "כריך", en: "Sandwich" },
    portion: { he: "כריך אחד", en: "1 sandwich" },
    calories: 390,
    protein_g: 18,
    carbs_g: 38,
    fat_g: 16,
    followUps: {
      he: ["מה היה בתוך הכריך?", "היה גם ממרח, גבינה או רוטב?"],
      en: ["What was inside the sandwich?", "Was there spread, cheese, or sauce?"],
    },
  },
  {
    id: "omelette",
    category: "main",
    labels: ["omelette", "scrambled eggs", "fried eggs", "boiled eggs", "eggs on a plate"],
    name: { he: "ביצים", en: "Eggs" },
    portion: { he: "2 ביצים", en: "2 eggs" },
    calories: 180,
    protein_g: 14,
    carbs_g: 2,
    fat_g: 13,
    followUps: {
      he: ["זה היה עם שמן או חמאה?", "היו גם ירקות, גבינה או לחם ליד?"],
      en: ["Was it cooked with oil or butter?", "Were there vegetables, cheese, or bread with it?"],
    },
  },
  {
    id: "sushi",
    category: "main",
    labels: ["sushi", "sushi rolls", "salmon sushi", "maki sushi"],
    name: { he: "סושי", en: "Sushi" },
    portion: { he: "8 יחידות", en: "8 pieces" },
    calories: 320,
    protein_g: 14,
    carbs_g: 44,
    fat_g: 8,
    followUps: {
      he: ["כמה יחידות היו?", "היה גם רוטב, טמפורה או מיונז?"],
      en: ["How many pieces were there?", "Was there sauce, tempura, or mayo?"],
    },
  },
  {
    id: "salmon",
    category: "main",
    labels: ["salmon fillet", "cooked salmon", "grilled salmon", "baked salmon"],
    name: { he: "סלמון", en: "Salmon" },
    portion: { he: "150 גרם", en: "150g" },
    calories: 300,
    protein_g: 30,
    carbs_g: 0,
    fat_g: 18,
    followUps: {
      he: ["היה גם שמן או רוטב מעל?", "הייתה תוספת ליד הדג?"],
      en: ["Was there oil or sauce on top?", "Was there a side with the fish?"],
    },
  },
  {
    id: "steak",
    category: "main",
    labels: ["steak", "beef steak", "grilled steak", "sliced steak"],
    name: { he: "סטייק", en: "Steak" },
    portion: { he: "180 גרם", en: "180g" },
    calories: 410,
    protein_g: 34,
    carbs_g: 0,
    fat_g: 28,
    followUps: {
      he: ["היה גם רוטב או חמאה?", "הייתה תוספת כמו תפוחי אדמה או אורז?"],
      en: ["Was there sauce or butter?", "Was there a side like potatoes or rice?"],
    },
  },
  {
    id: "soup",
    category: "main",
    labels: ["soup", "vegetable soup", "chicken soup", "ramen soup"],
    name: { he: "מרק", en: "Soup" },
    portion: { he: "קערה אחת", en: "1 bowl" },
    calories: 240,
    protein_g: 10,
    carbs_g: 24,
    fat_g: 9,
    followUps: {
      he: ["זה היה מרק שמנת או מרק צח?", "היה גם לחם ליד?"],
      en: ["Was it creamy soup or broth-based?", "Was there bread on the side?"],
    },
  },
  {
    id: "fries",
    category: "side",
    labels: ["french fries", "fries", "potato wedges", "fried potatoes"],
    name: { he: "צ'יפס", en: "Fries" },
    portion: { he: "מנה בינונית", en: "1 medium serving" },
    calories: 340,
    protein_g: 4,
    carbs_g: 44,
    fat_g: 16,
    followUps: {
      he: ["זו הייתה מנה קטנה או גדולה?", "היה גם רוטב בצד?"],
      en: ["Was it a small or large serving?", "Was there dipping sauce?"],
    },
  },
  {
    id: "fruit-bowl",
    category: "dessert",
    labels: ["fruit bowl", "mixed fruit", "fruit salad", "fresh fruit plate"],
    name: { he: "קערת פירות", en: "Fruit bowl" },
    portion: { he: "קערה אחת", en: "1 bowl" },
    calories: 160,
    protein_g: 2,
    carbs_g: 38,
    fat_g: 1,
    followUps: {
      he: ["היו גם יוגורט, גרנולה או דבש?", "זו הייתה קערה קטנה או גדולה?"],
      en: ["Did it include yogurt, granola, or honey?", "Was it a small or large bowl?"],
    },
  },
  {
    id: "yogurt-bowl",
    category: "dessert",
    labels: ["yogurt bowl", "greek yogurt", "granola yogurt", "chia pudding"],
    name: { he: "יוגורט", en: "Yogurt bowl" },
    portion: { he: "גביע גדול", en: "1 large cup" },
    calories: 220,
    protein_g: 15,
    carbs_g: 22,
    fat_g: 8,
    followUps: {
      he: ["היה גם גרנולה, דבש או פירות?", "זה היה יוגורט רגיל או יווני?"],
      en: ["Was there granola, honey, or fruit?", "Was it regular or Greek yogurt?"],
    },
  },
  {
    id: "cake",
    category: "dessert",
    labels: ["cake", "chocolate cake", "dessert cake", "cheesecake"],
    name: { he: "עוגה", en: "Cake" },
    portion: { he: "פרוסה אחת", en: "1 slice" },
    calories: 360,
    protein_g: 5,
    carbs_g: 42,
    fat_g: 18,
    followUps: {
      he: ["זו הייתה פרוסה קטנה או גדולה?", "היה גם קצפת או תוספת מעל?"],
      en: ["Was it a small or large slice?", "Was there whipped cream or topping?"],
    },
  },
  {
    id: "falafel",
    category: "main",
    labels: ["falafel plate", "falafel pita", "falafel balls", "falafel"],
    name: { he: "פלאפל", en: "Falafel" },
    portion: { he: "מנה רגילה", en: "1 regular serving" },
    calories: 520,
    protein_g: 16,
    carbs_g: 54,
    fat_g: 24,
    followUps: {
      he: ["זה היה בפיתה או בצלחת?", "היו גם טחינה, צ'יפס או סלטים?"],
      en: ["Was it in pita or on a plate?", "Did it include tahini, fries, or salads?"],
    },
  },
  {
    id: "hummus",
    category: "main",
    labels: ["hummus plate", "hummus dish", "hummus with pita", "hummus bowl"],
    name: { he: "חומוס", en: "Hummus" },
    portion: { he: "צלחת אחת", en: "1 plate" },
    calories: 430,
    protein_g: 16,
    carbs_g: 34,
    fat_g: 22,
    followUps: {
      he: ["היו גם פיתה, ביצה או שמן זית?", "זו הייתה צלחת אישית או גדולה?"],
      en: ["Was there pita, egg, or olive oil?", "Was it a personal or large plate?"],
    },
  },
  {
    id: "shawarma",
    category: "main",
    labels: ["shawarma", "shawarma plate", "shawarma pita", "chicken shawarma"],
    name: { he: "שווארמה", en: "Shawarma" },
    portion: { he: "מנה רגילה", en: "1 regular serving" },
    calories: 620,
    protein_g: 32,
    carbs_g: 40,
    fat_g: 34,
    followUps: {
      he: ["זה היה בפיתה, לאפה או בצלחת?", "היו גם טחינה, צ'יפס או שתייה?"],
      en: ["Was it in pita, laffa, or on a plate?", "Did it include tahini, fries, or a drink?"],
    },
  },
  {
    id: "noodles",
    category: "main",
    labels: ["noodles", "stir fry noodles", "ramen noodles", "asian noodles"],
    name: { he: "נודלס", en: "Noodles" },
    portion: { he: "קערה בינונית", en: "1 medium bowl" },
    calories: 470,
    protein_g: 14,
    carbs_g: 62,
    fat_g: 18,
    followUps: {
      he: ["היו גם ירקות, עוף או טופו?", "זה הוכן עם רוטב שמן או טריאקי?"],
      en: ["Did it include vegetables, chicken, or tofu?", "Was it cooked with oil or teriyaki sauce?"],
    },
  },
  {
    id: "cola",
    category: "drink",
    labels: ["cola", "soft drink", "soda can", "sweet drink"],
    name: { he: "משקה ממותק", en: "Soft drink" },
    portion: { he: "פחית אחת", en: "1 can" },
    calories: 140,
    carbs_g: 35,
    followUps: {
      he: ["זו הייתה פחית רגילה או גדולה?", "המשקה היה רגיל או זירו?"],
      en: ["Was it a regular can or a large bottle?", "Was the drink regular or zero?"],
    },
  },
  {
    id: "zero-cola",
    category: "drink",
    labels: ["diet cola", "zero cola", "zero soda", "sugar free drink"],
    name: { he: "משקה זירו", en: "Zero drink" },
    portion: { he: "פחית אחת", en: "1 can" },
    calories: 0,
    carbs_g: 0,
    followUps: {
      he: ["זו הייתה פחית אחת או יותר?", "היה גם משקה נוסף?"],
      en: ["Was it one can or more?", "Was there another drink too?"],
    },
  },
];

const NON_FOOD_LABELS = [
  "laptop",
  "mobile phone",
  "book",
  "keyboard",
  "dog",
  "cat",
  "car",
  "document",
  "table",
  "chair",
  "person portrait",
  "computer screen",
] as const;

const CATEGORY_PRIORITY: Record<FoodCategory, number> = {
  main: 0,
  side: 1,
  drink: 2,
  dessert: 3,
  generic: 4,
};

const mockProvider = new MockAIProvider();
const allLabels = [...new Set([...FOOD_PROFILES.flatMap((profile) => profile.labels), ...NON_FOOD_LABELS])];
let classifierPromise: Promise<LocalClassifier> | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeText(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function localize(locale: AppLocale, value: LocalizedText) {
  return value[locale];
}

function detectPortionMultiplier(text: string) {
  if (!text) return 1;
  if (/(חצי|half)/i.test(text)) return 0.5;
  if (/(קטן|small|mini)/i.test(text)) return 0.8;
  if (/(גדול|large|big|extra large)/i.test(text)) return 1.35;
  if (/(כפול|double|extra portion)/i.test(text)) return 1.75;
  return 1;
}

function buildPortionLabel(locale: AppLocale, fallback: string, multiplier: number) {
  if (multiplier <= 0.55) {
    return locale === "he" ? "חצי מנה" : "half portion";
  }
  if (multiplier >= 1.5) {
    return locale === "he" ? "מנה גדולה" : "large portion";
  }
  if (multiplier >= 1.2) {
    return locale === "he" ? "מנה מעט גדולה" : "slightly large portion";
  }
  if (multiplier <= 0.85) {
    return locale === "he" ? "מנה קטנה" : "small portion";
  }
  return fallback;
}

function confidenceFromScore(score: number, isAmbiguous: boolean): Confidence {
  const adjusted = isAmbiguous ? score - 0.12 : score;
  if (adjusted >= 0.65) return "high";
  if (adjusted >= 0.28) return "medium";
  return "low";
}

function roundOptional(value: number | undefined) {
  if (value === undefined) return undefined;
  return Math.max(0, Math.round(value));
}

function scaleItem(item: MealItemInput, multiplier: number, locale: AppLocale): MealItemInput {
  const factor = clamp(multiplier, 0.4, 2.2);
  return {
    ...item,
    estimated_quantity: buildPortionLabel(locale, item.estimated_quantity, factor),
    estimated_portion: buildPortionLabel(locale, item.estimated_portion ?? item.estimated_quantity, factor),
    estimated_calories: Math.max(0, Math.round(item.estimated_calories * factor)),
    protein_g: roundOptional(item.protein_g === undefined ? undefined : item.protein_g * factor),
    carbs_g: roundOptional(item.carbs_g === undefined ? undefined : item.carbs_g * factor),
    fat_g: roundOptional(item.fat_g === undefined ? undefined : item.fat_g * factor),
    source: "ai_estimate",
  };
}

function makeItem(profile: FoodProfile, locale: AppLocale, confidence: Confidence): MealItemInput {
  return {
    name: localize(locale, profile.name),
    estimated_quantity: localize(locale, profile.portion),
    estimated_portion: localize(locale, profile.portion),
    estimated_calories: profile.calories,
    protein_g: profile.protein_g,
    carbs_g: profile.carbs_g,
    fat_g: profile.fat_g,
    confidence,
    visual_confidence: confidence,
    source: "ai_estimate",
  };
}

function extractImageBlobFromBase64(dataUrl: string) {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid image payload");
  }
  const mimeType = matches[1];
  const base64 = matches[2];
  const buffer = Buffer.from(base64, "base64");
  return new Blob([buffer], { type: mimeType });
}

async function extractImageBlobFromUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Could not read the uploaded meal image.");
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await response.arrayBuffer());
  return new Blob([buffer], { type: contentType });
}

function findTopNonFoodScore(results: LabelScore[]) {
  const nonFoodLabels = new Set<string>(NON_FOOD_LABELS);
  return results.reduce((max, result) => {
    if (!nonFoodLabels.has(result.label)) return max;
    return Math.max(max, result.score);
  }, 0);
}

function getProfileScores(results: LabelScore[]) {
  return FOOD_PROFILES.map((profile) => ({
    profile,
    score: profile.labels.reduce((max, label) => {
      const match = results.find((entry) => entry.label === label);
      return Math.max(max, match?.score ?? 0);
    }, 0),
  })).sort((left, right) => right.score - left.score);
}

function selectProfiles(rankedProfiles: Array<{ profile: FoodProfile; score: number }>) {
  const bestSpecific = rankedProfiles.find(({ profile }) => profile.id !== MIXED_MEAL_PROFILE_ID);
  const bestAny = rankedProfiles[0];
  const primary = bestSpecific && bestSpecific.score >= 0.17 ? bestSpecific : bestAny;

  const selected = primary ? [primary] : [];
  for (const candidate of rankedProfiles) {
    if (!primary || selected.length >= 3) break;
    if (candidate.profile.id === primary.profile.id) continue;
    if (candidate.profile.id === MIXED_MEAL_PROFILE_ID) continue;
    if (selected.some((entry) => entry.profile.id === candidate.profile.id)) continue;

    const threshold = candidate.profile.category === "drink" ? 0.2 : candidate.profile.category === "side" ? 0.16 : 0.22;
    if (candidate.score < threshold) continue;
    if (candidate.profile.category !== "drink" && primary.score - candidate.score > 0.2) continue;
    if (
      candidate.profile.category !== "drink" &&
      selected.some((entry) => entry.profile.category === candidate.profile.category && entry.profile.category !== "side")
    ) {
      continue;
    }

    selected.push(candidate);
  }

  return selected.sort((left, right) => {
    const categoryDiff = CATEGORY_PRIORITY[left.profile.category] - CATEGORY_PRIORITY[right.profile.category];
    if (categoryDiff !== 0) return categoryDiff;
    return right.score - left.score;
  });
}

function buildExtraItems(locale: AppLocale, text: string) {
  const extras: MealItemInput[] = [];

  const pushExtra = (item: MealItemInput) => {
    if (extras.some((existing) => existing.name === item.name)) return;
    extras.push(item);
  };

  if (/(שמן זית|olive oil|extra oil|oil added|עם שמן)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "שמן זית" : "Olive oil",
      estimated_quantity: locale === "he" ? "כף אחת" : "1 tbsp",
      estimated_portion: locale === "he" ? "כף אחת" : "1 tbsp",
      estimated_calories: 120,
      fat_g: 14,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  }

  if (/(פרמזן|גבינה|cheese|parmesan)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "גבינה" : "Cheese topping",
      estimated_quantity: locale === "he" ? "מנה קטנה" : "small topping",
      estimated_portion: locale === "he" ? "מנה קטנה" : "small topping",
      estimated_calories: 90,
      protein_g: 6,
      fat_g: 7,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  }

  if (/(רוטב שמנת|cream sauce|alfredo)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "רוטב שמנת" : "Cream sauce",
      estimated_quantity: locale === "he" ? "תוספת רוטב" : "extra sauce",
      estimated_portion: locale === "he" ? "תוספת רוטב" : "extra sauce",
      estimated_calories: 170,
      carbs_g: 5,
      fat_g: 15,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  } else if (/(רוטב|tomato sauce|pasta sauce|sauce)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "רוטב" : "Sauce",
      estimated_quantity: locale === "he" ? "תוספת קטנה" : "small serving",
      estimated_portion: locale === "he" ? "תוספת קטנה" : "small serving",
      estimated_calories: 45,
      carbs_g: 8,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  }

  if (/(קולה זירו|cola zero|zero cola|diet coke|coke zero)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "קולה זירו" : "Zero cola",
      estimated_quantity: locale === "he" ? "פחית אחת" : "1 can",
      estimated_portion: locale === "he" ? "פחית אחת" : "1 can",
      estimated_calories: 0,
      carbs_g: 0,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  } else if (/(קולה|cola|juice|מיץ|soft drink|soda)/i.test(text)) {
    pushExtra({
      name: locale === "he" ? "משקה ממותק" : "Soft drink",
      estimated_quantity: locale === "he" ? "פחית אחת" : "1 can",
      estimated_portion: locale === "he" ? "פחית אחת" : "1 can",
      estimated_calories: 140,
      carbs_g: 35,
      confidence: "medium",
      visual_confidence: "low",
      source: "ai_estimate",
    });
  }

  return extras;
}

function refineMainItem(mainItem: MealItemInput, text: string) {
  const updated = { ...mainItem };

  if (/(מטוגן|fried|crispy)/i.test(text) && updated.name) {
    updated.estimated_calories += 80;
    updated.fat_g = roundOptional((updated.fat_g ?? 0) + 7);
    updated.confidence = "medium";
  }

  if (/(grilled|גריל|צלוי)/i.test(text) && /(fried|מטוגן|crispy)/i.test(text) === false) {
    updated.confidence = updated.confidence === "low" ? "medium" : updated.confidence;
  }

  return updated;
}

function buildNotes(locale: AppLocale, confidence: Confidence, text: string) {
  const notes = [
    locale === "he"
      ? "הערכים הם הערכה בלבד ומבוססים בעיקר על ניתוח חזותי של התמונה."
      : "Values are estimates only and are based primarily on visual image analysis.",
    locale === "he"
      ? "אפשר לדייק כמויות, תוספות וקלוריות לפני שמירה."
      : "You can refine quantities, extras, and calories before saving.",
  ];

  if (confidence === "low") {
    notes.push(
      locale === "he"
        ? "רמת הוודאות נמוכה יחסית, לכן מומלץ לבדוק את הכמות והתוספות."
        : "Confidence is relatively low, so it is best to review the portion and extras.",
    );
  }

  if (text) {
    notes.push(
      locale === "he"
        ? "הטקסט שנוסף שימש רק כדי לחדד את ההערכה מהתמונה."
        : "Any added text was used only to refine the image-based estimate.",
    );
  }

  return notes.slice(0, 4);
}

function buildFollowUps(
  locale: AppLocale,
  selectedProfiles: Array<{ profile: FoodProfile; score: number }>,
  confidence: Confidence,
  text: string,
) {
  const questions: string[] = [];
  const addQuestion = (question: string) => {
    if (!question || questions.includes(question)) return;
    questions.push(question);
  };

  for (const selected of selectedProfiles) {
    for (const question of selected.profile.followUps[locale]) {
      if (questions.length >= 3) break;
      addQuestion(question);
    }
  }

  if (confidence === "low") {
    addQuestion(
      locale === "he"
        ? "זו הייתה מנה אישית, חצי מנה או מנה גדולה?"
        : "Was this a half portion, regular portion, or large portion?",
    );
  }

  if (/(שתייה|drink)/i.test(text) === false) {
    addQuestion(
      locale === "he"
        ? "הייתה גם שתייה או תוספת בצד?"
        : "Was there a drink or side on the side?",
    );
  }

  return questions.slice(0, 3);
}

async function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.cacheDir = LOCAL_VISION_CACHE_DIR;
      const createPipeline = pipeline as unknown as (
        task: string,
        model: string,
        options?: Record<string, unknown>,
      ) => Promise<LocalClassifier>;
      const classifier = await createPipeline("zero-shot-image-classification", LOCAL_VISION_MODEL, {
        dtype: "q8",
      });
      return classifier;
    })();
  }

  return classifierPromise;
}

async function classifyImage(blob: Blob) {
  const classifier = await getClassifier();
  const results = await classifier(blob, allLabels, {
    hypothesis_template: "This is a photo of {}.",
  });
  return results.sort((left, right) => right.score - left.score);
}

async function resolveImageBlob(input: AnalyzeMealInput) {
  if (input.imageBase64) {
    return extractImageBlobFromBase64(input.imageBase64);
  }
  if (input.imageUrl) {
    return extractImageBlobFromUrl(input.imageUrl);
  }
  return null;
}

function buildNonFoodResponse(locale: AppLocale, score: number): MealAnalysis {
  const confidence = score >= 0.45 ? "high" : "medium";
  return analysisResultSchema.parse({
    items: [],
    total_estimated_calories: 0,
    confidence,
    contains_food: false,
    is_food: false,
    non_food_reason:
      locale === "he"
        ? "לא הצלחנו לזהות אוכל בתמונה. נסה להעלות צילום ברור יותר של הארוחה."
        : "We could not confidently detect food in the image. Please upload a clearer meal photo.",
    follow_up_questions: [
      locale === "he" ? "אפשר להעלות תמונה ברורה יותר של הארוחה?" : "Can you upload a clearer meal image?",
    ],
    notes: [
      locale === "he"
        ? "כרגע לא זוהה מזון בתמונה, ולכן לא נוסף חישוב קלוריות."
        : "No food was detected in the image, so no calorie estimate was added.",
    ],
  });
}

export class LocalVisionAIProvider extends BaseAIProvider {
  async analyzeMeal(input: AnalyzeMealInput) {
    const imageBlob = await resolveImageBlob(input);
    if (!imageBlob) {
      return mockProvider.analyzeMeal(input);
    }

    const normalizedText = normalizeText(input.mealDescription);
    const results = await classifyImage(imageBlob);
    const topNonFoodScore = findTopNonFoodScore(results);
    const rankedProfiles = getProfileScores(results);
    const selectedProfiles = selectProfiles(rankedProfiles);
    const bestFoodScore = selectedProfiles[0]?.score ?? 0;

    const containsFood =
      bestFoodScore >= 0.16 &&
      !(topNonFoodScore >= 0.42 && topNonFoodScore > bestFoodScore) &&
      !(bestFoodScore < 0.22 && topNonFoodScore + 0.02 >= bestFoodScore);

    if (!containsFood || selectedProfiles.length === 0) {
      return buildNonFoodResponse(input.locale, topNonFoodScore);
    }

    const isAmbiguous =
      selectedProfiles.length > 1 && Math.abs((selectedProfiles[0]?.score ?? 0) - (selectedProfiles[1]?.score ?? 0)) < 0.12;
    const confidence = confidenceFromScore(bestFoodScore, isAmbiguous);

    let items = selectedProfiles.map(({ profile, score }) =>
      makeItem(profile, input.locale, confidenceFromScore(score, isAmbiguous)),
    );

    const multiplier = detectPortionMultiplier(normalizedText);
    if (multiplier !== 1 && items[0]) {
      items[0] = scaleItem(items[0], multiplier, input.locale);
    }

    if (items[0]) {
      items[0] = refineMainItem(items[0], normalizedText);
    }

    const extras = buildExtraItems(input.locale, normalizedText);
    items = [...items, ...extras];

    const followUpQuestions = buildFollowUps(input.locale, selectedProfiles, confidence, normalizedText);
    const notes = buildNotes(input.locale, confidence, normalizedText);
    const total = items.reduce((sum, item) => sum + item.estimated_calories, 0);

    return analysisResultSchema.parse({
      items,
      total_estimated_calories: total,
      confidence,
      contains_food: true,
      is_food: true,
      follow_up_questions: followUpQuestions,
      notes,
    });
  }

  async chat(input: ChatInput) {
    return mockProvider.chat(input);
  }
}
