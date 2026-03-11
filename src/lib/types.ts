export type AppLocale = "he" | "en";

export type MealStatus = "draft" | "pending_confirmation" | "confirmed";

export type Confidence = "low" | "medium" | "high";

export type MealItemInput = {
  name: string;
  estimated_quantity: string;
  estimated_portion?: string;
  estimated_calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  confidence: Confidence;
  visual_confidence?: Confidence;
  source: "ai_estimate" | "user_confirmed";
};

export type MealAnalysis = {
  items: MealItemInput[];
  total_estimated_calories: number;
  confidence: Confidence;
  is_food: boolean;
  contains_food?: boolean;
  non_food_reason?: string;
  follow_up_questions: string[];
  notes: string[];
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type DashboardSummary = {
  todayCalories: number;
  weeklyCalories: Array<{ date: string; calories: number }>;
  streakDays: number;
  totalMeals: number;
  goal?: number;
};

