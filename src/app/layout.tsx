import type { Metadata } from "next";
import { Rubik, Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { getLocale } from "@/lib/i18n/get-locale";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "CalorieLens | AI Meal Tracker",
  description: "Track meals with AI image and chat estimation. Values are estimates only.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${rubik.variable} ${jakarta.variable} font-[var(--font-rubik)] antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

