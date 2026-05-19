"use client";

import { useTranslations } from "next-intl";

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="border-t border-[#2d3548] bg-[#0f1419] mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#94a3af]">
              © 2026 GIWATER. All rights reserved.
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-[#94a3af] hover:text-white transition-colors"
            >
              {t("footer.docs")}
            </a>
            <a
              href="#"
              className="text-sm text-[#94a3af] hover:text-white transition-colors"
            >
              {t("footer.github")}
            </a>
            <a
              href="#"
              className="text-sm text-[#94a3af] hover:text-white transition-colors"
            >
              {t("footer.twitter")}
            </a>
            <a
              href="#"
              className="text-sm text-[#94a3af] hover:text-white transition-colors"
            >
              {t("footer.discord")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
