import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAIProvider } from "@/lib/ai";
import { AIConfigurationError } from "@/lib/ai/errors";
import { analyzeMealRequestSchema } from "@/lib/validation/meal";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);
  try {
    const payload = analyzeMealRequestSchema.parse(await request.json());
    const requiresVision = Boolean(payload.imageBase64 || payload.imageUrl);
    if (process.env.NODE_ENV !== "production") {
      console.info(`[ai/analyze:${requestId}] request`, {
        hasImageBase64: Boolean(payload.imageBase64),
        hasImageUrl: Boolean(payload.imageUrl),
        hasDescription: Boolean(payload.mealDescription?.trim()),
        demoMode: payload.demoMode,
        locale: payload.locale,
        requiresVision,
      });
    }

    if (!payload.demoMode) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const provider = getAIProvider({
      allowMockFallback: payload.demoMode,
      mode: requiresVision ? "vision" : "chat",
    });
    const result = await provider.analyzeMeal(payload);
    const normalized = {
      ...result,
      contains_food: result.contains_food ?? result.is_food,
    };

    return NextResponse.json(normalized, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[ai/analyze:${requestId}] failed`, error);
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ?? "Invalid analyze request. Please provide a food image or meal description.",
        },
        { status: 400 },
      );
    }

    if (error instanceof AIConfigurationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "AI_VISION_PROVIDER_MISCONFIGURED",
          requestId,
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
        code: "AI_ANALYSIS_FAILED",
        requestId,
      },
      { status: 502 },
    );
  }
}

