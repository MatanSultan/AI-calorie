import type { AppLocale } from "@/lib/types";

type Copy = {
  appName: string;
  tagline: string;
  signIn: string;
  signUp: string;
  email: string;
  password: string;
  fullName: string;
  dashboard: string;
  chat: string;
  history: string;
  profile: string;
  save: string;
  logout: string;
  mealAssistant: string;
  upload: string;
  camera: string;
  manual: string;
  estimatesDisclaimer: string;
};

export const dictionary: Record<AppLocale, Copy> = {
  he: {
    appName: "CalorieLens",
    tagline: "מעקב קלוריות חכם עם AI",
    signIn: "התחברות",
    signUp: "הרשמה",
    email: "אימייל",
    password: "סיסמה",
    fullName: "שם מלא",
    dashboard: "דשבורד",
    chat: "צ'אט AI",
    history: "היסטוריה",
    profile: "פרופיל",
    save: "שמירה",
    logout: "התנתקות",
    mealAssistant: "עוזר הארוחות",
    upload: "העלאת תמונה",
    camera: "מצלמה",
    manual: "הזנה ידנית",
    estimatesDisclaimer: "הערכים הם הערכה בלבד ואינם ייעוץ רפואי.",
  },
  en: {
    appName: "CalorieLens",
    tagline: "Smart calorie tracking powered by AI",
    signIn: "Sign in",
    signUp: "Create account",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    dashboard: "Dashboard",
    chat: "AI Chat",
    history: "History",
    profile: "Profile",
    save: "Save",
    logout: "Log out",
    mealAssistant: "Meal assistant",
    upload: "Upload image",
    camera: "Camera",
    manual: "Manual entry",
    estimatesDisclaimer: "All values are estimates and not medical advice.",
  },
};
