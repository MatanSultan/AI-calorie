import { GroqAIProvider } from "@/lib/ai/providers/groq";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { CompositeAIProvider } from "@/lib/ai/providers/composite";
import { MockAIProvider } from "@/lib/ai/providers/mock";
import type { AIProvider } from "@/lib/ai/types";

export function getAIProvider(): AIProvider {
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
        process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct",
      ),
    );
  };

  const addOpenAI = () => {
    if (!openAiApiKey) return;
    providers.push(
      new OpenAIProvider(
        openAiApiKey,
        process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini",
        process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini",
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
    return new MockAIProvider();
  }

  return providers.length === 1 ? providers[0] : new CompositeAIProvider(providers);
}

