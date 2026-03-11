import type { AnalyzeMealInput, AIProvider, ChatInput } from "@/lib/ai/types";
import { AIConfigurationError } from "@/lib/ai/errors";

export class CompositeAIProvider implements AIProvider {
  constructor(private readonly providers: AIProvider[]) {}

  async analyzeMeal(input: AnalyzeMealInput) {
    let configError: Error | null = null;
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.analyzeMeal(input);
      } catch (error) {
        if (error instanceof AIConfigurationError) {
          configError = error;
          continue;
        }
        lastError = error instanceof Error ? error : new Error("Unknown AI analyze error");
      }
    }

    throw lastError ?? configError ?? new Error("No AI provider is configured.");
  }

  async chat(input: ChatInput) {
    let configError: Error | null = null;
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.chat(input);
      } catch (error) {
        if (error instanceof AIConfigurationError) {
          configError = error;
          continue;
        }
        lastError = error instanceof Error ? error : new Error("Unknown AI chat error");
      }
    }

    throw lastError ?? configError ?? new Error("No AI provider is configured.");
  }
}
