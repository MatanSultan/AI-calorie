import type { AppLocale, MealAnalysis, ChatMessage } from "@/lib/types";

export type AnalyzeMealInput = {
  imageUrl?: string;
  imageBase64?: string;
  mealDescription?: string;
  locale: AppLocale;
};

export type ChatInput = {
  locale: AppLocale;
  messages: ChatMessage[];
  analysisContext?: MealAnalysis;
};

export interface AIProvider {
  analyzeMeal(input: AnalyzeMealInput): Promise<MealAnalysis>;
  chat(input: ChatInput): Promise<string>;
}

