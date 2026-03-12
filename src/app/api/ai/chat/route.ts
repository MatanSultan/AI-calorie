import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getAIProvider } from "@/lib/ai";
import { AIConfigurationError } from "@/lib/ai/errors";
import { chatRequestSchema } from "@/lib/validation/meal";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = chatRequestSchema.parse(await request.json());
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
      mode: "chat",
    });
    const text = await provider.chat(payload);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const chunks = text.match(/.{1,28}/g) ?? [text];
        chunks.forEach((chunk, index) => {
          setTimeout(() => {
            controller.enqueue(encoder.encode(chunk));
            if (index === chunks.length - 1) controller.close();
          }, index * 22);
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid chat request." },
        { status: 400 },
      );
    }

    if (error instanceof AIConfigurationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat failed" },
      { status: 400 },
    );
  }
}

