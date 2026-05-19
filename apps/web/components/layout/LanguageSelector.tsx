"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/context/LocaleContext";
import { Locale, localeNames, localeFlags } from "@/lib/i18n";

export function LanguageSelector() {
  const { locale, setLocale, availableLocales } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  // Get short code for display
  const getShortCode = (loc: Locale) => {
    return loc === "ko" ? "KR" : "EN";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div
        className="relative p-[1px] rounded-[100px] overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #D4D4D4 -10%, #4B4B4B 50.5%, #000000 100%)",
        }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-3 py-2 rounded-[99px] text-neutral-300 hover:text-white transition-all"
          style={{
            background: "linear-gradient(180deg, #C4C4C4 -173.75%, #363636 140%)",
          }}
          aria-label="Select language"
          aria-expanded={isOpen}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <span className="body-14">{getShortCode(locale)}</span>
          <svg
            className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 rounded-xl overflow-hidden shadow-lg z-50"
          style={{
            background: "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {availableLocales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleSelect(loc)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                locale === loc
                  ? "bg-primary-700/20 text-primary-400"
                  : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <span className="text-lg">{localeFlags[loc]}</span>
              <span className="body-14-medium">{localeNames[loc]}</span>
              {locale === loc && (
                <svg
                  className="w-4 h-4 ml-auto text-primary-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
