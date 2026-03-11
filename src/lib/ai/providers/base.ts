import type { AnalyzeMealInput, AIProvider, ChatInput } from "@/lib/ai/types";

export abstract class BaseAIProvider implements AIProvider {
  abstract analyzeMeal(input: AnalyzeMealInput): Promise<import("@/lib/types").MealAnalysis>;

  abstract chat(input: ChatInput): Promise<string>;

  protected cleanJsonFence(raw: string) {
    return raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  }
}

