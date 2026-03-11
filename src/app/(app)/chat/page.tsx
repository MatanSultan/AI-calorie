import { getLocale } from "@/lib/i18n/get-locale";
import { CoachChatClient } from "@/components/chat/coach-chat-client";

export default async function ChatPage() {
  const locale = await getLocale();

  return (
    <div className="space-y-4">
      <CoachChatClient locale={locale} />
    </div>
  );
}
