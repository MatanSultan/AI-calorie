"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  History,
  ImageUp,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { prepareImageForAnalysis } from "@/lib/client/image";
import { MAX_LOCAL_MEAL_SOURCE_BYTES } from "@/lib/meal-config";
import type { AppLocale, ChatMessage, MealAnalysis, MealItemInput } from "@/lib/types";
import { formatCalories, toNumber } from "@/lib/utils";

type RecentMeal = {
  id: string;
  title: string;
  occurred_at: string;
  total_confirmed_calories: number | null;
  total_estimated_calories: number | null;
};

type Props = {
  locale: AppLocale;
  summary: {
    todayCalories: number;
    weeklyCalories: Array<{ date: string; calories: number }>;
    streakDays: number;
    totalMeals: number;
    goal?: number;
  };
  recentMeals: RecentMeal[];
};

type StoredMealImage = {
  path: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
};

type FinalizeResponse = {
  success: true;
  mealId: string;
  meal: RecentMeal & {
    status: "draft" | "pending_confirmation" | "confirmed";
  };
  image?: StoredMealImage | null;
  warnings?: string[];
};

function StepChip({ label, step }: { label: string; step: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm shadow-slate-950/5 backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-[11px] text-white">
        {step}
      </span>
      {label}
    </div>
  );
}

const copyByLocale = {
  he: {
    title: "מעקב קלוריות פשוט ב-3 שלבים",
    subtitle: "מעלים תמונת ארוחה, מקבלים הערכת קלוריות, מאשרים ושומרים ליומן היומי.",
    estimateOnly: "הערכים הם הערכה בלבד ואינם ייעוץ רפואי.",
    today: "הקלוריות של היום",
    progress: "התקדמות ליעד",
    streak: "רצף ימים",
    totalMeals: "ארוחות שמורות",
    step1: "שלב 1",
    step1Title: "צלם או העלה תמונת ארוחה",
    step1Description: "התמונה היא המקור הראשי לניתוח. אפשר גם להוסיף תיאור קצר כדי לדייק.",
    camera: "צלם ארוחה",
    upload: "העלה תמונה",
    capturePhoto: "צילום עכשיו",
    analyzing: "מנתחים את הארוחה...",
    analyze: "נתח את התמונה",
    imageHint: "העלה תמונת אוכל ברורה. לדוגמה: פסטה, סלט, עוף, כריך.",
    optionalText: "אפשר להוסיף תיאור קצר",
    optionalTextPlaceholder: "למשל: פסטה ברוטב עגבניות, הייתה גם גבינה מלמעלה",
    invalidType: "אפשר להעלות רק קובצי תמונה.",
    tooLarge: "התמונה גדולה מדי. נסו קובץ עד 8MB.",
    cameraError: "לא הצלחנו לפתוח מצלמה במכשיר הזה.",
    imageAlt: "תצוגה מקדימה של הארוחה",
    step2: "שלב 2",
    step2Title: "ה-AI מנתח את מה שצילמת",
    step2Description: "כאן רואים מה זוהה בתמונה, מה גודל המנה ומה ההערכה הקלורית.",
    noAnalysisYet: "אחרי שתעלו תמונה ותלחצו על ניתוח, תראו כאן את פירוט הארוחה.",
    detectedMeal: "זיהינו את מה שצילמת",
    notFood: "לא הצלחנו לזהות אוכל בתמונה, נסה להעלות תמונה ברורה יותר.",
    totalEstimate: "סה\"כ קלוריות משוערות",
    refineHint: "אפשר לדייק לפני שמירה על ידי עריכת כמויות, פריטים או קלוריות.",
    lowConfidence: "הזיהוי לא ודאי לגמרי. מומלץ לעדכן פרטים לפני שמירה.",
    followUpTitle: "שאלות קצרות כדי לדייק את ההערכה",
    notesTitle: "הערות מהניתוח",
    addItem: "הוסף פריט",
    macros: "מאקרו משוער",
    step3: "שלב 3",
    step3Title: "אישור ושמירה ליומן",
    step3Description: "אשרו את הארוחה כדי להוסיף אותה לסך הקלוריות של היום.",
    save: "אשר ושמור ארוחה",
    saving: "שומרים ארוחה...",
    savedTitle: "הארוחה נשמרה בהצלחה",
    savedBody: "הקלוריות היומיות עודכנו והארוחה נוספה להיסטוריה.",
    saveError: "לא הצלחנו לשמור את הארוחה. נסו שוב.",
    emptyAnalysis: "לא זוהו פריטי מזון. נסו תמונה ברורה יותר.",
    refinementTitle: "דייקו רק אם צריך",
    refinementDescription: "הצ'אט משמש רק לחידוד כמויות, רוטב, שתייה או שיטת ההכנה.",
    chatPlaceholder: "למשל: זה היה עם שמן זית",
    send: "שלח",
    chatExamples: ["זה היה עם שמן", "תוסיף גם שתייה", "זו הייתה חצי מנה", "זה היה עוף מטוגן"],
    recent: "ארוחות אחרונות",
    noMeals: "עדיין אין ארוחות שמורות.",
    openHistory: "פתח היסטוריה מלאה",
    weekly: "סיכום שבועי",
    quickSummary: "סיכום מהיר",
    summaryHint: "מעדכנים את הסך היומי רק אחרי אישור ושמירה.",
    addMealCta: "התחל ארוחה חדשה",
    updatedToday: "עודכן להיום",
    cancel: "ביטול",
  },
  en: {
    title: "A simple 3-step calorie flow",
    subtitle: "Upload a meal image, get an estimate, approve it, and add it to today.",
    estimateOnly: "Values are estimates only and not medical advice.",
    today: "Today's calories",
    progress: "Goal progress",
    streak: "Streak",
    totalMeals: "Saved meals",
    step1: "Step 1",
    step1Title: "Capture or upload a meal image",
    step1Description: "The image is the main source of analysis. Optional text only refines the result.",
    camera: "Capture meal",
    upload: "Upload image",
    capturePhoto: "Capture now",
    analyzing: "Analyzing your meal...",
    analyze: "Analyze image",
    imageHint: "Upload a clear food image. Example: pasta, salad, chicken, sandwich.",
    optionalText: "Optional short description",
    optionalTextPlaceholder: "For example: pasta with tomato sauce, there was cheese on top",
    invalidType: "Please upload an image file.",
    tooLarge: "Image is too large. Please use a file up to 8MB.",
    cameraError: "Could not open the camera on this device.",
    imageAlt: "Meal preview",
    step2: "Step 2",
    step2Title: "AI analyzes what you photographed",
    step2Description: "See what was detected, the estimated portion size, and calories.",
    noAnalysisYet: "Upload an image and run analysis to see the meal breakdown here.",
    detectedMeal: "We identified what you photographed",
    notFood: "We could not detect food in this image. Please upload a clearer meal photo.",
    totalEstimate: "Total estimated calories",
    refineHint: "You can refine the meal before saving by editing items, quantities, or calories.",
    lowConfidence: "Detection confidence is low. Recommended to refine details before saving.",
    followUpTitle: "Quick clarification questions",
    notesTitle: "Analysis notes",
    addItem: "Add item",
    macros: "Estimated macros",
    step3: "Step 3",
    step3Title: "Approve and save to your log",
    step3Description: "Approving adds this meal to today's calorie total.",
    save: "Approve and save meal",
    saving: "Saving meal...",
    savedTitle: "Meal saved successfully",
    savedBody: "Today's calories were updated and the meal was added to history.",
    saveError: "Could not save the meal. Please try again.",
    emptyAnalysis: "No food items were detected. Try a clearer image.",
    refinementTitle: "Refine only if needed",
    refinementDescription: "Chat is only for refining quantity, sauce, drink, or cooking method.",
    chatPlaceholder: "For example: it had olive oil",
    send: "Send",
    chatExamples: ["It had oil", "Add a drink", "It was half a portion", "It was fried chicken"],
    recent: "Recent meals",
    noMeals: "No saved meals yet.",
    openHistory: "Open full history",
    weekly: "Weekly summary",
    quickSummary: "Quick summary",
    summaryHint: "Daily calories update only after approval and save.",
    addMealCta: "Start a new meal",
    updatedToday: "Updated today",
    cancel: "Cancel",
  },
} as const;

export function DashboardClient({ locale, summary, recentMeals }: Props) {
  const copy = copyByLocale[locale];
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [todayCalories, setTodayCalories] = useState(summary.todayCalories);
  const [savedMealsCount, setSavedMealsCount] = useState(summary.totalMeals);
  const [weeklyCaloriesState, setWeeklyCaloriesState] = useState(summary.weeklyCalories);
  const [recentMealsState, setRecentMealsState] = useState(recentMeals);
  const [description, setDescription] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [items, setItems] = useState<MealItemInput[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    setTodayCalories(summary.todayCalories);
  }, [summary.todayCalories]);

  useEffect(() => {
    setSavedMealsCount(summary.totalMeals);
  }, [summary.totalMeals]);

  useEffect(() => {
    setWeeklyCaloriesState(summary.weeklyCalories);
  }, [summary.weeklyCalories]);

  useEffect(() => {
    setRecentMealsState(recentMeals);
  }, [recentMeals]);

  const currentMealCalories = useMemo(
    () => items.reduce((sum, item) => sum + toNumber(item.estimated_calories), 0),
    [items],
  );
  const goalProgress = summary.goal ? Math.min((todayCalories / summary.goal) * 100, 100) : 0;
  const containsFood = analysis ? (analysis.contains_food ?? analysis.is_food) : undefined;
  const hasDetectedMeal = Boolean(analysis && containsFood && items.length > 0);

  const quickBanner = useMemo(() => {
    if (summary.goal && todayCalories >= summary.goal) {
      return locale === "he"
        ? "הגעתם ליעד היומי שלכם. אם נשארה עוד ארוחה, שווה לאשר אותה כדי לשמור על תמונה מלאה."
        : "You reached your daily goal. If there is another meal, approve it to keep the day accurate.";
    }

    if (recentMealsState.length === 0) {
      return locale === "he"
        ? "היום עדיין פתוח. העלאת ארוחה אחת תעדכן מיד את הסיכום היומי."
        : "Your day is still open. Logging one meal will update today's summary immediately.";
    }

    return locale === "he"
      ? "אפשר לשמור על הזרימה פשוטה: תמונה, בדיקה קצרה, אישור."
      : "Keep the flow simple: image, quick review, approve.";
  }, [locale, recentMealsState.length, summary.goal, todayCalories]);

  function resetDraftState() {
    setAnalysis(null);
    setItems([]);
    setMessages([]);
    setSavedNotice(null);
    setAnalysisError(null);
    setSaveWarning(null);
  }

  async function handleFileSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(copy.invalidType);
      return;
    }
    if (file.size > MAX_LOCAL_MEAL_SOURCE_BYTES) {
      toast.error(locale === "he" ? "התמונה גדולה מדי לצילום מהיר. נסו קובץ עד 20MB." : "Image is too large. Please use a file up to 20MB.");
      return;
    }

    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    try {
      const dataUrl = await prepareImageForAnalysis(file);
      setImageBase64(dataUrl);
      resetDraftState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.invalidType);
    }
  }

  function closeCamera() {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video) video.srcObject = null;
    setCameraOn(false);
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraOn(true);
      }
    } catch {
      toast.error(copy.cameraError);
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;

    await handleFileSelected(new File([blob], `meal-${Date.now()}.jpg`, { type: "image/jpeg" }));
    closeCamera();
  }

  async function runAnalysis(explicitImageBase64?: string, refinedDescription?: string) {
    const imagePayload = explicitImageBase64 ?? imageBase64;
    if (!imagePayload) {
      toast.error(locale === "he" ? "צריך להעלות תמונת ארוחה לפני ניתוח." : "Please upload a meal image before analysis.");
      return;
    }

    setAnalyzing(true);
    setSavedNotice(null);
    setAnalysis(null);
    setItems([]);
    setMessages([]);
    setAnalysisError(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          imageBase64: explicitImageBase64 ?? imageBase64,
          mealDescription: refinedDescription ?? description,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Analyze failed");
      }

      const result = payload as MealAnalysis;
      setAnalysis(result);
      setItems(result.items ?? []);
      setMessages([]);

      if ((result.contains_food ?? result.is_food) === false) {
        toast.error(result.non_food_reason ?? copy.notFood);
      } else {
        toast.success(copy.detectedMeal);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyze failed";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(index: number, patch: Partial<MealItemInput>) {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch, source: "user_confirmed" } : item,
      ),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        name: locale === "he" ? "פריט חדש" : "New item",
        estimated_quantity: locale === "he" ? "מנה אחת" : "1 serving",
        estimated_portion: locale === "he" ? "מנה אחת" : "1 serving",
        estimated_calories: 100,
        confidence: "medium",
        source: "user_confirmed",
      },
    ]);
  }

  function buildRefinementText(chatMessages: ChatMessage[]) {
    const recentClarifications = chatMessages
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join(" | ");

    if (!recentClarifications) return description;

    if (locale === "he") {
      return `${description}\nהבהרות משתמש: ${recentClarifications}`.trim();
    }
    return `${description}\nUser clarifications: ${recentClarifications}`.trim();
  }

  function updateWeeklyCaloriesAfterSave(totalCalories: number, occurredAtIso: string) {
    const entryDate = new Date(occurredAtIso).toISOString().slice(0, 10);
    setWeeklyCaloriesState((prev) => {
      if (prev.length === 0) return prev;
      let found = false;
      const next = prev.map((entry) => {
        if (entry.date !== entryDate) return entry;
        found = true;
        return { ...entry, calories: entry.calories + totalCalories };
      });
      return found ? next : prev;
    });
  }

  async function refineFromConversation(chatMessages: ChatMessage[]) {
    if (!analysis || !containsFood) return;

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          imageBase64,
          mealDescription: buildRefinementText(chatMessages),
        }),
      });

      if (!response.ok) return;
      const payload = (await response.json()) as MealAnalysis;
      if ((payload.contains_food ?? payload.is_food) === false) return;

      setAnalysis(payload);
      setItems(payload.items ?? []);
      toast.success(locale === "he" ? "ההערכה עודכנה לפי ההבהרה שלך" : "Estimate updated from your clarification");
    } catch {
      // Keep chat useful even if the refresh call fails.
    }
  }

  async function sendChat(prefilled?: string) {
    const content = (prefilled ?? chatInput).trim();
    if (!content) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setChatInput("");
    setChatting(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: nextMessages,
          analysisContext: analysis,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Chat failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiText };
          return updated;
        });
      }

      await refineFromConversation(nextMessages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed");
    } finally {
      setChatting(false);
    }
  }

  async function saveMeal() {
    if (!items.length) {
      toast.error(copy.emptyAnalysis);
      return;
    }
    if (containsFood === false) {
      toast.error(copy.notFood);
      return;
    }

    setSaving(true);
    setSaveWarning(null);

    try {
      const response = await fetch("/api/meals/finalize", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          title: description?.slice(0, 80) || (locale === "he" ? "ארוחה חדשה" : "New meal"),
          status: "confirmed",
          occurredAt: new Date().toISOString(),
          notes: analysis?.notes.join("\n") || undefined,
          imageBase64: imageBase64 || undefined,
          analysis: analysis ?? {
            items,
            total_estimated_calories: currentMealCalories,
            confidence: "medium",
            is_food: true,
            contains_food: true,
            follow_up_questions: [],
            notes: [],
          },
          items,
          messages,
          conversationSummary: messages
            .filter((message) => message.role !== "system")
            .slice(-4)
            .map((message) => message.content)
            .join(" | "),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Partial<FinalizeResponse> & { error?: string };
      if (!response.ok) {
        throw new Error(payload?.error ?? copy.saveError);
      }

      const confirmedCalories = payload.meal?.total_confirmed_calories ?? currentMealCalories;
      const warningText = payload.warnings?.filter(Boolean).join(" ");

      setTodayCalories((prev) => prev + confirmedCalories);
      setSavedMealsCount((prev) => prev + 1);
      updateWeeklyCaloriesAfterSave(confirmedCalories, payload.meal?.occurred_at ?? new Date().toISOString());

      if (payload.meal) {
        const savedMeal = payload.meal;
        setRecentMealsState((prev) => [savedMeal, ...prev.filter((meal) => meal.id !== savedMeal.id)].slice(0, 5));
      }

      if (warningText) {
        setSaveWarning(warningText);
      }

      const successMessage = warningText
        ? locale === "he"
          ? `${copy.savedTitle}. הארוחה נשמרה, אבל התמונה לא צורפה הפעם.`
          : `${copy.savedTitle}. The meal was saved, but the image could not be attached this time.`
        : `${copy.savedTitle}. ${copy.savedBody}`;

      setSavedNotice(successMessage);
      toast.success(copy.savedTitle);

      setDescription("");
      setImageBase64(undefined);
      setImagePreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setAnalysis(null);
      setItems([]);
      setMessages([]);

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f766e_0%,#0891b2_48%,#1d4ed8_100%)] p-0 text-white shadow-[0_32px_80px_-42px_rgba(15,23,42,0.65)]">
        <div className="grid gap-5 px-5 py-6 sm:px-6 md:grid-cols-[1.3fr_0.9fr] md:items-end">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-cyan-50 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.updatedToday}: {new Date().toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{copy.title}</h1>
            <p className="max-w-2xl text-sm text-cyan-50 sm:text-base">{copy.subtitle}</p>
            <div className="flex flex-wrap gap-2">
              <StepChip step="1" label={copy.step1Title} />
              <StepChip step="2" label={copy.step2Title} />
              <StepChip step="3" label={copy.step3Title} />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-slate-950/15 p-4 backdrop-blur">
            <p className="text-sm font-semibold text-white/90">{copy.today}</p>
            <p className="mt-2 text-4xl font-bold">{formatCalories(todayCalories)}</p>
            {summary.goal ? (
              <>
                <Progress className="mt-4 bg-white/15 [&>div]:bg-white" value={goalProgress} />
                <p className="mt-2 text-xs font-medium text-cyan-50">
                  {copy.progress}: {Math.round(goalProgress)}%
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-cyan-50">{copy.summaryHint}</p>
            )}
          </div>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <div className="space-y-4">
          <Card id="capture" className="space-y-5 overflow-hidden border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <div className="space-y-2">
              <StepChip step="1" label={copy.step1} />
              <CardTitle className="text-lg">{copy.step1Title}</CardTitle>
              <CardDescription>{copy.step1Description}</CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="shadow-lg shadow-emerald-900/15" onClick={openCamera}>
                <Camera className="ms-2 h-4 w-4" />
                {copy.camera}
              </Button>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
              />
              <Button size="lg" variant="outline" className="bg-white/80 dark:bg-slate-950/70" onClick={() => fileInputRef.current?.click()}>
                <ImageUp className="ms-2 h-4 w-4" />
                {copy.upload}
              </Button>
            </div>

            {cameraOn ? (
              <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-950 p-3 dark:border-slate-700">
                <video ref={videoRef} autoPlay playsInline className="h-64 w-full rounded-2xl object-cover" />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={captureFromCamera}>
                    {copy.capturePhoto}
                  </Button>
                  <Button className="flex-1" variant="outline" onClick={closeCamera}>
                    {copy.cancel}
                  </Button>
                </div>
              </div>
            ) : null}

            {imagePreview ? (
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                <img src={imagePreview} alt={copy.imageAlt} className="h-72 w-full object-cover" />
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-emerald-200 bg-[linear-gradient(180deg,rgba(16,185,129,0.06),rgba(255,255,255,0.82))] px-5 py-10 text-center dark:border-emerald-950/50 dark:bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(2,6,23,0.35))]">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.imageHint}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.optionalText}</label>
              <Textarea
                ref={noteInputRef}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={copy.optionalTextPlaceholder}
              />
            </div>

            <Button className="w-full sm:w-auto" size="lg" onClick={() => runAnalysis()} disabled={analyzing || !imageBase64}>
              {analyzing ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Sparkles className="ms-2 h-4 w-4" />}
              {analyzing ? copy.analyzing : copy.analyze}
            </Button>
          </Card>

          <Card className="space-y-4 border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <div className="space-y-2">
              <StepChip step="2" label={copy.step2} />
              <CardTitle className="text-lg">{copy.step2Title}</CardTitle>
              <CardDescription>{copy.step2Description}</CardDescription>
            </div>

            {!analysis ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {analysisError ?? copy.noAnalysisYet}
                </p>
              </div>
            ) : containsFood === false ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-100">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {analysis.non_food_reason ?? copy.notFood}
                </p>
                {analysis.follow_up_questions.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs font-medium">
                    {analysis.follow_up_questions.slice(0, 2).map((question) => (
                      <li key={question}>- {question}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                  <div className="rounded-[28px] border border-cyan-200/80 bg-[linear-gradient(180deg,rgba(6,182,212,0.12),rgba(255,255,255,0.92))] p-4 dark:border-cyan-900/60 dark:bg-[linear-gradient(180deg,rgba(8,145,178,0.25),rgba(2,6,23,0.55))]">
                  <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">{copy.detectedMeal}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant={analysis.confidence}>{analysis.confidence}</Badge>
                    <span className="text-sm font-semibold text-cyan-950 dark:text-cyan-50">
                      {copy.totalEstimate}: {formatCalories(currentMealCalories || analysis.total_estimated_calories)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-cyan-900 dark:text-cyan-100">{copy.refineHint}</p>
                </div>

                {analysis.confidence === "low" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                    {copy.lowConfidence}
                  </div>
                ) : null}

                {analysis.follow_up_questions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.followUpTitle}</p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.follow_up_questions.slice(0, 3).map((question) => (
                        <Badge key={question} variant="muted">
                          {question}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {locale === "he" ? "פירוט פריטים" : "Detected items"}
                  </p>
                  <Button size="sm" variant="ghost" onClick={addItem}>
                    <Plus className="ms-1 h-4 w-4" />
                    {copy.addItem}
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{copy.emptyAnalysis}</p>
                  ) : (
                    items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/85">
                        <div className="grid gap-2 sm:grid-cols-[1.15fr_1fr_120px_auto]">
                          <Input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} />
                          <Input
                            value={item.estimated_portion ?? item.estimated_quantity}
                            onChange={(event) =>
                              updateItem(index, {
                                estimated_quantity: event.target.value,
                                estimated_portion: event.target.value,
                              })
                            }
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={item.estimated_calories}
                            onChange={(event) => updateItem(index, { estimated_calories: toNumber(event.target.value) })}
                          />
                          <div className="flex items-center justify-between gap-2 sm:justify-end">
                            <Badge variant={item.confidence}>{item.confidence}</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                              aria-label={locale === "he" ? "מחיקת פריט" : "Delete item"}
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </div>
                        </div>

                        {item.protein_g !== undefined || item.carbs_g !== undefined || item.fat_g !== undefined ? (
                          <p className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {copy.macros}:{" "}
                            {item.protein_g !== undefined ? `${locale === "he" ? "חלבון" : "Protein"} ${Math.round(item.protein_g)}g ` : ""}
                            {item.carbs_g !== undefined ? `${locale === "he" ? "פחמימות" : "Carbs"} ${Math.round(item.carbs_g)}g ` : ""}
                            {item.fat_g !== undefined ? `${locale === "he" ? "שומן" : "Fat"} ${Math.round(item.fat_g)}g` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                {analysis.notes.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.notesTitle}</p>
                    <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                      {analysis.notes.slice(0, 4).map((note) => (
                        <li key={note}>- {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          <Card className="space-y-4 border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <div className="space-y-2">
              <StepChip step="3" label={copy.step3} />
              <CardTitle className="text-lg">{copy.step3Title}</CardTitle>
              <CardDescription>{copy.step3Description}</CardDescription>
            </div>

            {savedNotice ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                  {savedNotice}
                </p>
              </div>
            ) : null}

            {saveWarning ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                {saveWarning}
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.totalEstimate}</p>
              <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-50">
                {formatCalories(currentMealCalories || analysis?.total_estimated_calories || 0)}
              </p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{copy.estimateOnly}</p>
            </div>

            <Button className="w-full sm:w-auto" size="lg" onClick={saveMeal} disabled={saving || !hasDetectedMeal}>
              {saving ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Save className="ms-2 h-4 w-4" />}
              {saving ? copy.saving : copy.save}
            </Button>

            {analysis && containsFood ? (
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="space-y-1">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <PencilLine className="h-4 w-4 text-cyan-600" />
                    {copy.refinementTitle}
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{copy.refinementDescription}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {copy.chatExamples.map((example) => (
                    <Button key={example} size="sm" variant="secondary" onClick={() => sendChat(example)} disabled={chatting}>
                      {example}
                    </Button>
                  ))}
                </div>

                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {messages.length === 0 ? (
                    <p className="rounded-2xl bg-white p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {locale === "he"
                        ? "הצ'אט כאן רק אם צריך לדייק משהו קטן לפני שמירה."
                        : "Chat is only here if you want to refine a small detail before saving."}
                    </p>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={
                          message.role === "assistant"
                            ? "rounded-2xl bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
                            : "rounded-2xl bg-white p-3 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                        }
                      >
                        {message.content}
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder={copy.chatPlaceholder}
                  />
                  <Button onClick={() => sendChat()} disabled={chatting || !chatInput.trim()}>
                    {chatting ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.send}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4 border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{copy.quickSummary}</CardTitle>
                <CardDescription className="mt-1">{quickBanner}</CardDescription>
              </div>
              <Link
                href="/history"
                className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <History className="ms-1 h-4 w-4" />
                {copy.openHistory}
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.today}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-50">{formatCalories(todayCalories)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.streak}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-50">{summary.streakDays}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{copy.totalMeals}</p>
                <p className="mt-2 text-3xl font-bold text-slate-950 dark:text-slate-50">{savedMealsCount}</p>
              </div>
            </div>
          </Card>

          <Card className="border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <CardTitle>{copy.weekly}</CardTitle>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyCaloriesState}>
                  <defs>
                    <linearGradient id="weekly-calories" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: "#334155", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#334155", fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="calories" stroke="#059669" strokeWidth={2} fill="url(#weekly-calories)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="space-y-3 border border-white/60 bg-white/88 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/78">
            <div className="flex items-center justify-between">
              <CardTitle>{copy.recent}</CardTitle>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()}>
                {copy.addMealCta}
              </Button>
            </div>

            {recentMealsState.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                {copy.noMeals}
              </p>
            ) : (
              recentMealsState.map((meal) => (
                <Link
                  key={meal.id}
                  href={`/history/${meal.id}`}
                  className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-950/40"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{meal.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {new Date(meal.occurred_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")} |{" "}
                    {formatCalories(meal.total_confirmed_calories ?? meal.total_estimated_calories ?? 0)}
                  </p>
                </Link>
              ))
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
