import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { finalizeMealSchema } from "@/lib/validation/meal";

export const runtime = "nodejs";

function getFinalizeStatus(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("unauthorized")) return 401;
  if (message.includes("row-level security") || message.includes("permission")) return 403;
  if (message.includes("duplicate key") || message.includes("already exists")) return 409;
  if (message.includes("network") || message.includes("service unavailable")) return 503;

  return 500;
}

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);
  const supabase = await createClient();
  let createdMealId: string | null = null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = finalizeMealSchema.parse(await request.json());

    const containsFood = payload.analysis.contains_food ?? payload.analysis.is_food;
    if (!containsFood) {
      return NextResponse.json(
        {
          error: "Cannot save this meal because the submitted image or description was classified as non-food.",
        },
        { status: 400 },
      );
    }

    const estimatedTotal = Math.max(0, Math.round(payload.analysis.total_estimated_calories));
    const confirmedTotal = payload.items.reduce((sum, item) => sum + Math.max(0, Math.round(item.estimated_calories)), 0);
    const occurredAt = payload.occurredAt ?? new Date().toISOString();

    const { data: meal, error: mealError } = await supabase
      .from("meal_entries")
      .insert({
        user_id: user.id,
        title: payload.title,
        status: payload.status,
        notes: payload.notes,
        total_estimated_calories: estimatedTotal,
        total_confirmed_calories: confirmedTotal,
        occurred_at: occurredAt,
      })
      .select("id,title,status,occurred_at,total_estimated_calories,total_confirmed_calories")
      .single();

    if (mealError || !meal) {
      throw mealError ?? new Error("Failed to create meal entry.");
    }

    createdMealId = meal.id;

    if (payload.items.length > 0) {
      const itemRows = payload.items.map((item) => ({
        meal_entry_id: meal.id,
        user_id: user.id,
        name: item.name,
        estimated_quantity: item.estimated_portion ?? item.estimated_quantity,
        estimated_calories: Math.max(0, Math.round(item.estimated_calories)),
        protein_g: item.protein_g ?? null,
        carbs_g: item.carbs_g ?? null,
        fat_g: item.fat_g ?? null,
        confidence: item.confidence,
        source: item.source,
      }));

      const { error: itemsError } = await supabase.from("meal_items").insert(itemRows);
      if (itemsError) throw itemsError;
    }

    if (payload.image) {
      const { error: imageError } = await supabase.from("meal_images").upsert({
        meal_entry_id: meal.id,
        user_id: user.id,
        storage_path: payload.image.path,
        public_url: payload.image.publicUrl,
        mime_type: payload.image.mimeType,
        size_bytes: payload.image.sizeBytes,
      });
      if (imageError) throw imageError;
    }

    if (payload.messages.length > 0) {
      const { data: conversation, error: conversationError } = await supabase
        .from("meal_conversations")
        .insert({
          meal_entry_id: meal.id,
          user_id: user.id,
          summary: payload.conversationSummary ?? null,
        })
        .select("id")
        .single();

      if (conversationError || !conversation) {
        throw conversationError ?? new Error("Failed to create meal conversation.");
      }

      const messageRows = payload.messages.map((message) => ({
        meal_entry_id: meal.id,
        conversation_id: conversation.id,
        user_id: user.id,
        role: message.role,
        content: message.content,
      }));

      const { error: messagesError } = await supabase.from("meal_messages").insert(messageRows);
      if (messagesError) throw messagesError;
    }

    if (process.env.NODE_ENV !== "production") {
      console.info(`[meals/finalize:${requestId}] saved`, {
        mealId: meal.id,
        userId: user.id,
        confirmedTotal,
        hasImage: Boolean(payload.image),
        itemsCount: payload.items.length,
      });
    }

    return NextResponse.json(
      {
        success: true,
        mealId: meal.id,
        meal: {
          id: meal.id,
          title: meal.title,
          occurred_at: meal.occurred_at,
          total_confirmed_calories: meal.total_confirmed_calories,
          total_estimated_calories: meal.total_estimated_calories,
          status: meal.status,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (createdMealId) {
      await supabase.from("meal_entries").delete().eq("id", createdMealId);
    }

    if (process.env.NODE_ENV !== "production") {
      console.error(`[meals/finalize:${requestId}] failed`, error);
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid meal payload." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Meal saving failed. Please try again in a moment.",
      },
      { status: getFinalizeStatus(error) },
    );
  }
}
