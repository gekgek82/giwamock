"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { IntlProvider } from "next-intl";
import {
  Locale,
  locales,
  defaultLocale,
} from "@/lib/i18n";

// Import messages directly
import koMessages from "@/messages/ko.json";
import enMessages from "@/messages/en.json";

const messages: Record<Locale, typeof koMessages> = {
  ko: koMessages,
  en: enMessages,
};

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: typeof locales;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: defaultLocale,
  setLocale: () => {},
  availableLocales: locales,
});

export function useLocale() {
  return useContext(LocaleContext);
}

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  // Locale is fixed to "en" per legal requirements
  const locale: Locale = "en";
  const isHydrated = true;

  const setLocale = useCallback((_newLocale: Locale) => {
    // No-op: locale is fixed to "en"
  }, []);

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      availableLocales: locales,
    }),
    [locale, setLocale]
  );

  // Always render with IntlProvider - use default locale until hydrated
  const currentLocale = isHydrated ? locale : defaultLocale;

  return (
    <LocaleContext.Provider value={contextValue}>
      <IntlProvider
        locale={currentLocale}
        messages={messages[currentLocale]}
        timeZone="Asia/Seoul"
      >
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
