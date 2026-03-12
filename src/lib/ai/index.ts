import { GroqAIProvider } from "@/lib/ai/providers/groq";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { CompositeAIProvider } from "@/lib/ai/providers/composite";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import { AIConfigurationError } from "@/lib/ai/errors";
import type { AIProvider } from "@/lib/ai/types";

type ProviderMode = "chat" | "vision";

type GetAIProviderOptions = {
  allowMockFallback?: boolean;
  mode?: ProviderMode;
};

const SUPPORTED_GROQ_VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
];

const DEPRECATED_GROQ_VISION_MODELS = [
  "llama-3.2-11b-vision-preview",
  "llama-3.2-90b-vision-preview",
];

function uniqueModels(...groups: string[][]) {
  return [...new Set(groups.flat().map((value) => value.trim()).filter(Boolean))];
}

function resolveGroqVisionModel() {
  const configuredModel = process.env.GROQ_VISION_MODEL?.trim();

  if (!configuredModel) {
    return SUPPORTED_GROQ_VISION_MODELS[0];
  }

  if (DEPRECATED_GROQ_VISION_MODELS.includes(configuredModel)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[ai/config] Ignoring deprecated GROQ_VISION_MODEL '${configuredModel}'.`);
    }
    return SUPPORTED_GROQ_VISION_MODELS[0];
  }

  return uniqueModels([configuredModel], SUPPORTED_GROQ_VISION_MODELS)[0];
}

function buildConfigurationError(mode: ProviderMode) {
  if (mode === "vision") {
    return new AIConfigurationError(
      "No working vision provider is configured. Enable a Groq vision model for this project or set OPENAI_API_KEY with a vision-capable model.",
    );
  }

  return new AIConfigurationError(
    "No AI text provider is configured. Set GROQ_API_KEY or OPENAI_API_KEY.",
  );
}

export function getAIProvider(options?: GetAIProviderOptions): AIProvider {
  const mode = options?.mode ?? "chat";
  const allowMockFallback = options?.allowMockFallback ?? false;
  const providers: AIProvider[] = [];
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  const providerPreference = process.env.AI_PROVIDER?.trim().toLowerCase();

  const addGroq = () => {
    if (!groqApiKey) return;
    providers.push(
      new GroqAIProvider(
        groqApiKey,
        process.env.GROQ_TEXT_MODEL ?? "llama-3.3-70b-versatile",
        resolveGroqVisionModel(),
      ),
    );
  };

  const addOpenAI = () => {
    if (!openAiApiKey) return;
    providers.push(
      new OpenAIProvider(
        openAiApiKey,
        process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
        process.env.OPENAI_VISION_MODEL ?? "gpt-4.1-mini",
      ),
    );
  };

  if (providerPreference === "openai") {
    addOpenAI();
    addGroq();
  } else {
    addGroq();
    addOpenAI();
  }

  if (providers.length === 0) {
    if (allowMockFallback) {
      return new MockAIProvider();
    }
    throw buildConfigurationError(mode);
  }

  if (allowMockFallback) {
    return new CompositeAIProvider(providers, {
      fallbackProvider: new MockAIProvider(),
    });
  }

  return new CompositeAIProvider(providers);
}
