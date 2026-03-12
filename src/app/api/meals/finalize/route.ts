import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
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

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function t(locale: "he" | "en", he: string, en: string) {
  return locale === "he" ? he : en;
}

function deriveMealTitle(locale: "he" | "en", rawTitle: string, itemNames: string[]) {
  const fallbackTitle = t(locale, "ארוחה חדשה", "New meal");
  const trimmedTitle = rawTitle.trim();
  const isGenericTitle = [fallbackTitle, t(locale, "ארוחה", "Meal")].includes(trimmedTitle);

  if (trimmedTitle && !isGenericTitle) {
    return trimmedTitle.slice(0, 120);
  }

  const fromItems = itemNames.filter(Boolean).slice(0, 2).join(" + ");
  return (fromItems || fallbackTitle).slice(0, 120);
}

function looksLikeSchemaMismatch(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: string }).code ?? "").toLowerCase() : "";

  return (
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    code === "pgrst205"
  );
}

function normalizePersistError(error: unknown) {
  if (looksLikeSchemaMismatch(error)) {
    return new Error(
      "Supabase meal tables are not available in the API schema cache. Apply migrations 001_init.sql, 002_repair_meal_schema_and_policies.sql, and 003_finalize_flow_indexes_and_policies.sql to the linked project.",
    );
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("row-level security") || message.includes("permission")) {
    return new Error("Supabase RLS blocked meal persistence. Reapply the meal table policies for authenticated users.");
  }

  return error instanceof Error ? error : new Error("Meal saving failed. Please try again in a moment.");
}

function getFinalizeStatus(error: unknown) {
  const normalizedError = normalizePersistError(error);
  const message = normalizedError.message.toLowerCase();

  if (message.includes("unauthorized")) return 401;
  if (message.includes("row-level security") || message.includes("permission")) return 403;
  if (message.includes("duplicate key") || message.includes("already exists")) return 409;
  if (message.includes("network") || message.includes("service unavailable")) return 503;

  return 500;
}

function getFinalizeCode(error: unknown) {
  const normalizedError = normalizePersistError(error);
  const message = normalizedError.message.toLowerCase();

  if (message.includes("schema cache") || message.includes("migrations 001_init.sql")) return "SUPABASE_SCHEMA_MISSING";
  if (message.includes("row-level security") || message.includes("permission")) return "SUPABASE_RLS_DENIED";
  if (message.includes("duplicate key") || message.includes("already exists")) return "MEAL_ALREADY_EXISTS";
  if (message.includes("unauthorized")) return "AUTH_REQUIRED";
  return "MEAL_SAVE_FAILED";
}

async function insertMealEntryRobust(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: MealEntryRow,
) {
  const attempts: Array<Partial<MealEntryRow>> = [
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

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from("meal_entries")
      .insert(attempt)
      .select("id,title,status,occurred_at,total_estimated_calories,total_confirmed_calories")
      .single();

    if (!error && data) return data;
    lastError = error ?? lastError;
    if (!looksLikeSchemaMismatch(error)) break;
  }

  throw normalizePersistError(lastError);
}

async function insertMealItemsStrict(
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
    if (!error) return;
    lastError = error ?? lastError;
    if (!looksLikeSchemaMismatch(error)) break;
  }

  throw normalizePersistError(lastError);
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
      return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED", requestId }, { status: 401 });
    }

    const payload = finalizeMealSchema.parse(await request.json());
    const locale = payload.locale;
    const containsFood = payload.analysis.contains_food ?? payload.analysis.is_food;

    if (!containsFood) {
      return NextResponse.json(
        {
          error: t(
            locale,
            "אי אפשר לשמור את הארוחה כי התמונה או התיאור סווגו כלא-מזון.",
            "Cannot save this meal because the submitted image or description was classified as non-food.",
          ),
          code: "NON_FOOD_MEAL",
          requestId,
        },
        { status: 400 },
      );
    }

    const sanitizedItems = payload.items
      .map((item) => {
        const name = item.name.trim();
        const quantity = (item.estimated_portion ?? item.estimated_quantity).trim();

        return {
          ...item,
          name,
          estimated_quantity: quantity,
          estimated_portion: quantity,
          estimated_calories: Math.max(0, Math.round(item.estimated_calories)),
        };
      })
      .filter((item) => item.name.length > 0 && item.estimated_quantity.length > 0);

    if (sanitizedItems.length === 0) {
      return NextResponse.json(
        {
          error: t(
            locale,
            "לא זוהו פריטי מזון תקינים לשמירה. בדקו את הפריטים לפני אישור.",
            "No valid meal items were available to save. Please review the detected items before approving.",
          ),
          code: "MEAL_ITEMS_EMPTY",
          requestId,
        },
        { status: 400 },
      );
    }

    const estimatedTotal = Math.max(
      0,
      Math.round(payload.analysis.total_estimated_calories || sanitizedItems.reduce((sum, item) => sum + item.estimated_calories, 0)),
    );
    const confirmedTotal = sanitizedItems.reduce((sum, item) => sum + item.estimated_calories, 0);
    const occurredAt = payload.occurredAt ?? new Date().toISOString();
    const title = deriveMealTitle(locale, payload.title, sanitizedItems.map((item) => item.name));

    const meal = await insertMealEntryRobust(supabase, {
      user_id: user.id,
      title,
      status: payload.status,
      notes: payload.notes?.trim() || undefined,
      total_estimated_calories: estimatedTotal,
      total_confirmed_calories: confirmedTotal,
      occurred_at: occurredAt,
    });

    createdMealId = meal.id;

    const itemRows = sanitizedItems.map((item) => ({
      meal_entry_id: meal.id,
      user_id: user.id,
      name: item.name,
      estimated_quantity: item.estimated_portion ?? item.estimated_quantity,
      estimated_calories: item.estimated_calories,
      protein_g: item.protein_g ?? null,
      carbs_g: item.carbs_g ?? null,
      fat_g: item.fat_g ?? null,
      confidence: item.confidence,
      source: item.source,
    })) satisfies MealItemRow[];

    await insertMealItemsStrict(supabase, itemRows);

    let imageForSave = payload.image ?? null;

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
        warnings.push(
          imageError instanceof Error
            ? imageError.message
            : t(
                locale,
                "העלאת התמונה נכשלה, לכן הארוחה נשמרה בלי תמונה.",
                "Image upload failed, so the meal was saved without an attached image.",
              ),
        );

        if (isDevelopment()) {
          console.warn(`[meals/finalize:${requestId}] image upload skipped`, imageError);
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
        { onConflict: "meal_entry_id" },
      );

      if (imageError) {
        warnings.push(
          imageError.message ||
            t(
              locale,
              "לא הצלחנו לקשר את נתוני התמונה, לכן הארוחה נשמרה בלי תמונה מצורפת.",
              "Image metadata could not be linked, so the meal was saved without an attached image.",
            ),
        );

        if (isDevelopment()) {
          console.warn(`[meals/finalize:${requestId}] image metadata skipped`, imageError);
        }
      }
    }

    if (payload.messages.length > 0) {
      const { data: conversation, error: conversationError } = await supabase
        .from("meal_conversations")
        .insert({
          meal_entry_id: meal.id,
          user_id: user.id,
          summary: payload.conversationSummary?.trim() || null,
        })
        .select("id")
        .single();

      if (conversationError || !conversation) {
        warnings.push(
          conversationError?.message ||
            t(
              locale,
              "לא הצלחנו לשמור את הערות החידוד, אבל הארוחה עצמה נשמרה.",
              "Meal refinement notes could not be saved, but the meal itself was saved successfully.",
            ),
        );
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
            messagesError.message ||
              t(
                locale,
                "לא הצלחנו לשמור את היסטוריית החידוד, אבל הארוחה עצמה נשמרה.",
                "Meal refinement history could not be saved, but the meal itself was saved successfully.",
              ),
          );
        }
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/history");
    revalidatePath(`/history/${meal.id}`);

    if (isDevelopment()) {
      console.info(`[meals/finalize:${requestId}] saved`, {
        mealId: meal.id,
        userId: user.id,
        confirmedTotal,
        hasImage: Boolean(imageForSave),
        itemsCount: sanitizedItems.length,
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
        image: imageForSave,
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

    const normalizedError = normalizePersistError(error);

    if (isDevelopment()) {
      console.error(`[meals/finalize:${requestId}] failed`, normalizedError);
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid meal payload.",
          code: "INVALID_FINALIZE_PAYLOAD",
          requestId,
        },
        { status: 400 },
      );
    }

    const payload: Record<string, unknown> = {
      error: normalizedError.message,
      code: getFinalizeCode(normalizedError),
      requestId,
    };

    if (isDevelopment() && error && typeof error === "object") {
      const maybeError = error as { name?: string; code?: string; details?: string; hint?: string; stack?: string };
      payload.debug = {
        name: maybeError.name ?? null,
        code: maybeError.code ?? null,
        details: maybeError.details ?? null,
        hint: maybeError.hint ?? null,
      };
    }

    return NextResponse.json(payload, { status: getFinalizeStatus(normalizedError) });
  }
}
