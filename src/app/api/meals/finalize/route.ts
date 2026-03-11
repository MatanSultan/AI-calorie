import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { decodeDataUrlImage, storeMealImage } from "@/lib/meals/store-image";
import { createClient } from "@/lib/supabase/server";
import { finalizeMealSchema } from "@/lib/validation/meal";

export const runtime = "nodejs";

type MealEntryRow = {
  user_id: string;
  title: string;
  status: "draft" | "pending_confirmation" | "confirmed";
  notes?: string;
  total_estimated_calories: number;
  total_confirmed_calories: number;
  occurred_at: string;
};

type MealItemRow = {
  meal_entry_id: string;
  user_id: string;
  name: string;
  estimated_quantity: string;
  estimated_calories: number;
  protein_g: number | null | undefined;
  carbs_g: number | null | undefined;
  fat_g: number | null | undefined;
  confidence: "low" | "medium" | "high";
  source: "ai_estimate" | "user_confirmed";
};

function t(locale: "he" | "en", he: string, en: string) {
  return locale === "he" ? he : en;
}

function getFinalizeStatus(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("unauthorized")) return 401;
  if (message.includes("row-level security") || message.includes("permission")) return 403;
  if (message.includes("duplicate key") || message.includes("already exists")) return 409;
  if (message.includes("network") || message.includes("service unavailable")) return 503;

  return 500;
}

function looksLikeSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

async function insertMealEntryRobust(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: MealEntryRow,
) {
  const entryAttempts: Array<Partial<MealEntryRow>> = [
    row,
    {
      user_id: row.user_id,
      title: row.title,
      status: row.status,
      total_estimated_calories: row.total_estimated_calories,
      total_confirmed_calories: row.total_confirmed_calories,
      occurred_at: row.occurred_at,
    },
    {
      user_id: row.user_id,
      title: row.title,
      status: row.status,
      total_estimated_calories: row.total_estimated_calories,
      occurred_at: row.occurred_at,
    },
  ];

  let lastError: unknown = new Error("Failed to create meal entry.");
  for (const attempt of entryAttempts) {
    const { data, error } = await supabase
      .from("meal_entries")
      .insert(attempt)
      .select("id,title,status,occurred_at,total_estimated_calories,total_confirmed_calories")
      .single();

    if (!error && data) return data;
    lastError = error ?? lastError;
    if (!looksLikeSchemaMismatch(error)) break;
  }

  throw lastError;
}

async function insertMealItemsRobust(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemRows: MealItemRow[],
) {
  const attempts = [
    itemRows.map((row) => row),
    itemRows.map(({ source, ...row }) => row),
    itemRows.map(({ protein_g, carbs_g, fat_g, ...row }) => row),
    itemRows.map(({ protein_g, carbs_g, fat_g, source, ...row }) => row),
    itemRows.map(({ protein_g, carbs_g, fat_g, source, confidence, ...row }) => row),
  ];

  let lastError: unknown = new Error("Failed to save meal items.");
  for (const attempt of attempts) {
    const { error } = await supabase.from("meal_items").insert(attempt);
    if (!error) return { saved: true as const };
    lastError = error ?? lastError;
    if (!looksLikeSchemaMismatch(error)) break;
  }

  return { saved: false as const, error: lastError };
}

export async function POST(request: Request) {
  const requestId = randomUUID().slice(0, 8);
  const supabase = await createClient();
  let createdMealId: string | null = null;
  const warnings: string[] = [];

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = finalizeMealSchema.parse(await request.json());
    const locale = payload.locale;

    const containsFood = payload.analysis.contains_food ?? payload.analysis.is_food;
    if (!containsFood) {
      return NextResponse.json(
        {
          error: t(
            locale,
            "אי אפשר לשמור את הארוחה כי התמונה או התיאור סווגו כלא אוכל.",
            "Cannot save this meal because the submitted image or description was classified as non-food.",
          ),
        },
        { status: 400 },
      );
    }

    const estimatedTotal = Math.max(0, Math.round(payload.analysis.total_estimated_calories));
    const confirmedTotal = payload.items.reduce((sum, item) => sum + Math.max(0, Math.round(item.estimated_calories)), 0);
    const occurredAt = payload.occurredAt ?? new Date().toISOString();

    const meal = await insertMealEntryRobust(supabase, {
      user_id: user.id,
      title: payload.title,
      status: payload.status,
      notes: payload.notes,
      total_estimated_calories: estimatedTotal,
      total_confirmed_calories: confirmedTotal,
      occurred_at: occurredAt,
    });

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
      })) satisfies MealItemRow[];

      const itemsResult = await insertMealItemsRobust(supabase, itemRows);
      if (!itemsResult.saved) {
        const fallbackNotes = [
          payload.notes?.trim(),
          `Meal items fallback: ${payload.items
            .map((item) => `${item.name} (${item.estimated_portion ?? item.estimated_quantity}, ${Math.round(item.estimated_calories)} kcal)`)
            .join(", ")}`,
        ]
          .filter(Boolean)
          .join("\n");

        const { error: notesFallbackError } = await supabase
          .from("meal_entries")
          .update({ notes: fallbackNotes })
          .eq("id", meal.id)
          .eq("user_id", user.id);

        warnings.push(
          t(
            locale,
            "לא הצלחנו לשמור את פירוט הפריטים בטבלה המלאה, לכן צירפנו סיכום טקסטואלי לארוחה.",
            "Meal items could not be saved in the detailed table, so a text summary was attached to the meal instead.",
          ),
        );

        if (notesFallbackError && process.env.NODE_ENV !== "production") {
          console.warn(`[meals/finalize:${requestId}] item fallback notes skipped`, notesFallbackError);
        }
      }
    }

    let imageForSave = payload.image;

    if (!imageForSave && payload.imageBase64) {
      try {
        const decodedImage = decodeDataUrlImage(payload.imageBase64);
        imageForSave = await storeMealImage(supabase, {
          userId: user.id,
          fileName: decodedImage.fileName,
          mimeType: decodedImage.mimeType,
          sizeBytes: decodedImage.buffer.byteLength,
          buffer: decodedImage.buffer,
        });
      } catch (imageError) {
        const warning =
          imageError instanceof Error
            ? imageError.message
            : t(
                locale,
                "העלאת התמונה נכשלה, לכן הארוחה תישמר בלי התמונה.",
                "Image upload failed, so the meal will be saved without the image.",
              );
        warnings.push(warning);
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[meals/finalize:${requestId}] image attachment skipped`, imageError);
        }
      }
    }

    if (imageForSave) {
      const { error: imageError } = await supabase.from("meal_images").upsert(
        {
          meal_entry_id: meal.id,
          user_id: user.id,
          storage_path: imageForSave.path,
          public_url: imageForSave.publicUrl,
          mime_type: imageForSave.mimeType,
          size_bytes: imageForSave.sizeBytes,
        },
        {
          onConflict: "meal_entry_id",
        },
      );

      if (imageError) {
        warnings.push(
          imageError instanceof Error
            ? imageError.message
            : t(
                locale,
                "לא הצלחנו לקשר את נתוני התמונה, לכן הארוחה נשמרה בלי קובץ מצורף.",
                "Image metadata could not be linked, so the meal was saved without an attached image.",
              ),
        );

        if (process.env.NODE_ENV !== "production") {
          console.warn(`[meals/finalize:${requestId}] image row skipped`, imageError);
        }
      }
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
        warnings.push(
          conversationError instanceof Error
            ? conversationError.message
            : t(
                locale,
                "לא הצלחנו לשמור את הערות הארוחה, אבל הארוחה עצמה נשמרה בהצלחה.",
                "Meal notes could not be saved, but the meal itself was saved successfully.",
              ),
        );

        if (process.env.NODE_ENV !== "production") {
          console.warn(`[meals/finalize:${requestId}] conversation skipped`, conversationError);
        }
      } else {
        const messageRows = payload.messages.map((message) => ({
          meal_entry_id: meal.id,
          conversation_id: conversation.id,
          user_id: user.id,
          role: message.role,
          content: message.content,
        }));

        const { error: messagesError } = await supabase.from("meal_messages").insert(messageRows);
        if (messagesError) {
          warnings.push(
            messagesError instanceof Error
              ? messagesError.message
              : t(
                  locale,
                  "לא הצלחנו לשמור את היסטוריית הצ'אט, אבל הארוחה עצמה נשמרה בהצלחה.",
                  "Meal chat history could not be saved, but the meal itself was saved successfully.",
                ),
          );

          if (process.env.NODE_ENV !== "production") {
            console.warn(`[meals/finalize:${requestId}] messages skipped`, messagesError);
          }
        }
      }
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
        image: imageForSave ?? null,
        warnings,
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
