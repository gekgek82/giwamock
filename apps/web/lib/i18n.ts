import { getRequestConfig } from "next-intl/server";

export type Locale = "ko" | "en";

export const locales: Locale[] = ["ko", "en"];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
};

export const localeFlags: Record<Locale, string> = {
  ko: "🇰🇷",
  en: "🇺🇸",
};

// Storage key for locale preference
export const LOCALE_STORAGE_KEY = "giwater-locale";

export default getRequestConfig(async () => {
  // Default to Korean - will be overridden by client-side context
  const locale = defaultLocale;

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
