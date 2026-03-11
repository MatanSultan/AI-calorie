import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextRaw = request.nextUrl.searchParams.get("next") ?? "/dashboard";
  const next = nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const fallback = new URL("/sign-in", request.url);
      fallback.searchParams.set("error", "auth_callback_failed");
      return NextResponse.redirect(fallback);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

