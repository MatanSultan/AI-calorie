"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AppLocale, ChatMessage } from "@/lib/types";

const prompts = {
  he: [
    "כמה קלוריות אכלתי היום?",
    "תן לי רעיון לארוחת ערב עד 450 קלוריות",
    "תוסיף גם את השתייה להערכה שלי",
    "נראה לי שאכלתי מעט חלבון. מה מומלץ?",
  ],
  en: [
    "How many calories did I eat today?",
    "Give me a dinner idea under 450 calories",
    "Include my drink in the estimate",
    "I think my protein is low today",
  ],
} as const;

type Props = {
  locale: AppLocale;
};

export function CoachChatClient({ locale }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(content: string) {
    const userText = content.trim();
    if (!userText) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          messages: nextMessages,
        }),
      });

      if (!response.ok || !response.body) throw new Error("Request failed");

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
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            locale === "he"
              ? "לא הצלחתי לענות כרגע. נסו שוב בעוד רגע."
              : "I could not answer right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-600" />
        {locale === "he" ? "עוזר תזונה חכם" : "Nutrition AI Coach"}
      </CardTitle>
      <CardDescription className="mt-1">
        {locale === "he"
          ? "אפשר לשאול על סיכום יומי, רעיונות לארוחות, דיוק רישום, ושיפור עקביות."
          : "Ask about daily summary, meal ideas, logging clarifications, and consistency."}
      </CardDescription>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {prompts[locale].map((prompt) => (
            <Button key={prompt} size="sm" variant="secondary" onClick={() => ask(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {locale === "he"
                ? "התחילו עם שאלה קצרה. למשל: כמה קלוריות אכלתי היום?"
                : "Start with a quick question, for example: how many calories did I eat today?"}
            </p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role === "assistant"
                    ? "rounded-xl bg-emerald-100 p-2.5 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100"
                    : "rounded-xl bg-white p-2.5 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                }
              >
                {message.content}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={locale === "he" ? "כתבו שאלה..." : "Ask a question..."}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(input);
              }
            }}
          />
          <Button onClick={() => ask(input)} disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : locale === "he" ? "שליחה" : "Send"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
