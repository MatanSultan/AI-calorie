"use client";

import { useEffect, useState } from "react";
import { ImageUp, Loader2, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MEAL_IMAGE_UPLOAD_BYTES } from "@/lib/meal-config";
import type { AppLocale, ChatMessage, MealAnalysis, MealItemInput } from "@/lib/types";
import { formatCalories, toNumber } from "@/lib/utils";
import { prepareImageForAnalysis } from "@/lib/client/image";

export function DemoClient({ locale }: { locale: AppLocale }) {
  const [description, setDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [items, setItems] = useState<MealItemInput[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  async function onFileSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(locale === "he" ? "אפשר להעלות רק קובצי תמונה" : "Unsupported file type");
      return;
    }
    if (file.size > MAX_MEAL_IMAGE_UPLOAD_BYTES) {
      toast.error(
        locale === "he"
          ? "התמונה גדולה מדי. נסו קובץ עד 8MB."
          : "Image is too large. Please use a file up to 8MB.",
      );
      return;
    }
    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    try {
      const dataUrl = await prepareImageForAnalysis(file);
      setImageBase64(dataUrl);
      setAnalysisError(null);
    } catch {
      toast.error(locale === "he" ? "לא הצלחנו לעבד את התמונה" : "Could not process image");
    }
  }

  async function analyze() {
    setAnalyzing(true);
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
          imageBase64,
          mealDescription: description,
          demoMode: true,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Analysis failed");
      }
      const payload = (await response.json()) as MealAnalysis;
      setAnalysis(payload);
      setItems(payload.items ?? []);
      setMessages([]);
      const containsFood = payload.contains_food ?? payload.is_food;
      if (!containsFood) {
        toast.error(
          payload.non_food_reason ??
            (locale === "he" ? "לא זוהה אוכל בתמונה הזאת" : "This image was not detected as food"),
        );
      } else {
        toast.success(locale === "he" ? "הניתוח מוכן" : "Analysis is ready");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error";
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(index: number, patch: Partial<MealItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function sendChat() {
    const content = chatInput.trim();
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
          demoMode: true,
        }),
      });
      if (!response.ok || !response.body) throw new Error("Chat failed");
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed");
    } finally {
      setChatting(false);
    }
  }

  const total = items.reduce((sum, item) => sum + toNumber(item.estimated_calories), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card className="border-0 bg-gradient-to-l from-emerald-600 via-cyan-600 to-blue-700 text-white">
        <CardTitle className="text-white">
          {locale === "he" ? "ניסיון חינם - ללא הרשמה" : "Free trial - no signup required"}
        </CardTitle>
        <CardDescription className="mt-2 text-cyan-50">
          {locale === "he"
            ? "במצב ניסיון אפשר לנתח ארוחה ולשוחח עם ה-AI, בלי שמירה להיסטוריה."
            : "In trial mode you can analyze meals and chat with AI without saving history."}
        </CardDescription>
      </Card>

      <Card className="space-y-4">
        <CardTitle>{locale === "he" ? "1) העלאת תמונה או תיאור" : "1) Upload image or text"}</CardTitle>
        <label className="block rounded-xl border border-dashed border-slate-300 p-4 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)} />
          <span className="inline-flex items-center gap-2"><ImageUp className="h-4 w-4" />{locale === "he" ? "לחצו לבחירת תמונה" : "Choose an image"}</span>
        </label>
        {imagePreview ? <img src={imagePreview} alt="preview" className="h-52 w-full rounded-xl object-cover" /> : null}
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={locale === "he" ? "למשל: אורז, עוף, סלט וכוס מיץ" : "For example: rice, chicken, salad, and juice"}
        />
        <Button onClick={analyze} disabled={analyzing || (!description.trim() && !imageBase64)}>
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          <span className="ms-2">{locale === "he" ? "ניתוח ארוחה" : "Analyze meal"}</span>
        </Button>
      </Card>

      {analysis ? (
        <Card className="space-y-3">
          <CardTitle>{locale === "he" ? "2) תוצאות AI ועריכה" : "2) AI results and editing"}</CardTitle>
          {(analysis.contains_food ?? analysis.is_food) === false ? (
            <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">
              {analysis.non_food_reason ??
                (locale === "he"
                  ? "לא זוהה מזון בתמונה. נסו תמונת ארוחה ברורה יותר."
                  : "No food was detected in this image. Try a clearer meal image.")}
            </p>
          ) : null}
          {items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1.2fr_1fr_120px] dark:border-slate-700">
              <Input value={item.name} onChange={(e) => updateItem(index, { name: e.target.value })} />
              <Input value={item.estimated_quantity} onChange={(e) => updateItem(index, { estimated_quantity: e.target.value })} />
              <Input
                type="number"
                value={item.estimated_calories}
                onChange={(e) => updateItem(index, { estimated_calories: toNumber(e.target.value) })}
              />
            </div>
          ))}
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {locale === "he" ? "סה\"כ משוער:" : "Estimated total:"} {formatCalories(total)}
          </p>
          {analysis.follow_up_questions.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {locale === "he" ? "שאלות להבהרה:" : "Clarification questions:"}
              </p>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {analysis.follow_up_questions.slice(0, 3).map((question) => (
                  <li key={question}>- {question}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {locale === "he"
              ? "הערכים להדגמה בלבד. במצב ניסיון אין שמירה להיסטוריה."
              : "Values are estimates for demo only. Trial mode does not persist history."}
          </p>
        </Card>
      ) : analysisError ? (
        <Card>
          <p className="rounded-xl bg-rose-100 px-3 py-2 text-sm font-medium text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">
            {analysisError}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cyan-600" />
          {locale === "he" ? "3) צ'אט קצר עם AI" : "3) Quick AI chat"}
        </CardTitle>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {locale === "he" ? "אפשר לשאול: כמה אורז נראה בתמונה? האם יש גם רוטב?" : "Try asking: how much rice is this? does it include sauce?"}
            </p>
          ) : (
            messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className="rounded-xl bg-white p-2 text-sm dark:bg-slate-900">
                {message.content}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={locale === "he" ? "כתבו שאלה..." : "Ask a question..."}
          />
          <Button onClick={sendChat} disabled={chatting || !chatInput.trim()}>
            {chatting ? <Loader2 className="h-4 w-4 animate-spin" /> : locale === "he" ? "שליחה" : "Send"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
