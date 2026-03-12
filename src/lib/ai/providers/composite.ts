import type { AnalyzeMealInput, AIProvider, ChatInput } from "@/lib/ai/types";
import { AIConfigurationError } from "@/lib/ai/errors";

type CompositeOptions = {
  fallbackProvider?: AIProvider;
};

function providerName(provider: AIProvider) {
  return provider.constructor?.name ?? "UnknownAIProvider";
}

export class CompositeAIProvider implements AIProvider {
  constructor(
    private readonly providers: AIProvider[],
    private readonly options?: CompositeOptions,
  ) {}

  async analyzeMeal(input: AnalyzeMealInput) {
    let configError: Error | null = null;
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        return await provider.analyzeMeal(input);
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error("Unknown AI analyze error");
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[ai/analyze] ${providerName(provider)} failed`, normalizedError.message);
        }

        if (error instanceof AIConfigurationError) {
          configError = error;
          continue;
        }
        lastError = normalizedError;
      }
    }

    if (this.options?.fallbackProvider) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ai/analyze] Using ${providerName(this.options.fallbackProvider)} fallback because all real providers failed.`,
          lastError?.message ?? configError?.message ?? "No configured providers",
        );
      }
      return this.options.fallbackProvider.analyzeMeal(input);
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
        const normalizedError = error instanceof Error ? error : new Error("Unknown AI chat error");
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[ai/chat] ${providerName(provider)} failed`, normalizedError.message);
        }

        if (error instanceof AIConfigurationError) {
          configError = error;
          continue;
        }
        lastError = normalizedError;
      }
    }

    if (this.options?.fallbackProvider) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[ai/chat] Using ${providerName(this.options.fallbackProvider)} fallback because all real providers failed.`,
          lastError?.message ?? configError?.message ?? "No configured providers",
        );
      }
      return this.options.fallbackProvider.chat(input);
    }

    throw lastError ?? configError ?? new Error("No AI provider is configured.");
  }
}
