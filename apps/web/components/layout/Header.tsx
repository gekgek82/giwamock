"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { GIWA_SEPOLIA_CHAIN_ID } from "@/lib/config";
import { pageHeaderOuterClassName } from "@/lib/page-layout";
import { useSettingsStore } from "@/lib/store";
import { SettingsModal } from "@/components/settings/SettingsModal";

interface NavItem {
  key: "swap" | "liquidity" | "lockVote" | "earn" | "myPortfolio";
  href: string;
}

const navigationItems: NavItem[] = [
  { key: "swap", href: "/swap" },
  { key: "liquidity", href: "/liquidity" },
  { key: "lockVote", href: "/vote" },
  { key: "earn", href: "/earn" },
  { key: "myPortfolio", href: "/portfolio" },
];

// Mobile dropdown icons (Figma 1457:36841). Stroke uses currentColor so the
// icon recolors with the active/inactive text color of its parent button.
function NavIcon({
  name,
  className = "size-5",
}: {
  name: "swap" | "liquidity" | "lockVote" | "myPortfolio";
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  if (name === "swap") {
    return (
      <svg viewBox="0 0 19 20" {...common}>
        <path d="M8 6.5C8.45473 4.49601 10.2469 3 12.3885 3C14.8738 3 16.8885 5.01472 16.8885 7.5C16.8885 9.80209 15.1598 11.7004 12.9298 11.9678M5 5L7 3L5 1M1 7V5.66667C1 4.19391 2.19391 3 3.66667 3H5.66667M14 15L12 17L14 19M18 13V14.3333C18 15.8061 16.8061 17 15.3333 17H13.3333M10 13.5C10 15.9853 7.98528 18 5.5 18C3.01472 18 1 15.9853 1 13.5C1 11.0147 3.01472 9 5.5 9C7.98528 9 10 11.0147 10 13.5Z" />
      </svg>
    );
  }
  if (name === "liquidity") {
    return (
      <svg viewBox="0 0 18 14" {...common}>
        <path d="M1.00027 11.6107L2.99112 10.9163C4.75002 10.3029 6.6898 10.495 8.29424 11.4415C9.92412 12.4029 11.8986 12.5852 13.6769 11.9382L17.0003 10.7292M1.00027 6.82913L2.99112 6.1348C4.75002 5.52136 6.6898 5.71343 8.29424 6.65991C9.92412 7.62139 11.8986 7.80362 13.6769 7.15668L17.0003 5.94768M1.00027 2.04758L2.99112 1.35325C4.75002 0.739811 6.6898 0.931886 8.29424 1.87836C9.92412 2.83984 11.8986 3.02207 13.6769 2.37514L17.0003 1.16613" />
      </svg>
    );
  }
  if (name === "lockVote") {
    return (
      <svg viewBox="0 0 14 18" {...common}>
        <path d="M2.5 6.33333V5.57143C2.5 3.039 4.50714 1 7 1C9.49286 1 11.5 3.039 11.5 5.57143V6.33333M2.5 6.33333C1.675 6.33333 1 7.01905 1 7.85714V15.4762C1 16.3143 1.675 17 2.5 17H11.5C12.325 17 13 16.3143 13 15.4762V7.85714C13 7.01905 12.325 6.33333 11.5 6.33333M2.5 6.33333H11.5" />
      </svg>
    );
  }
  // myPortfolio
  return (
    <svg viewBox="0 0 18 19" {...common}>
      <path d="M8.52941 17.4708C12.6878 17.4708 16.0588 14.0997 16.0588 9.94133H8.52941L8.52945 2.4119C4.37106 2.41187 1 5.78293 1 9.94133C1 14.0997 4.37103 17.4708 8.52941 17.4708Z" />
      <path d="M11.8235 1V6.57466H17V6.17647C17 3.31758 14.6824 1 11.8235 1Z" />
    </svg>
  );
}

const dropdownNavIcons: Record<
  NavItem["key"],
  "swap" | "liquidity" | "lockVote" | "myPortfolio" | null
> = {
  swap: "swap",
  liquidity: "liquidity",
  lockVote: "lockVote",
  earn: null,
  myPortfolio: "myPortfolio",
};

export function Header() {
  const pathname = usePathname();
  const { chain } = useAccount();
  const t = useTranslations();
  const { openSettings } = useSettingsStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isWrongNetwork = chain && chain.id !== GIWA_SEPOLIA_CHAIN_ID;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="relative z-50">
      {/* Navigation Bar */}
      <div className={pageHeaderOuterClassName()}>
        <div className="bg-brand-black rounded-[40px] h-[72px] pl-[30px] pr-[16px] py-[16px] flex items-center justify-between">
          {/* Left - Logo and Navigation */}
          <div className="flex items-center gap-[55px]">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center shrink-0"
              aria-label="GIWATER"
            >
              <img
                src="/giwater-glyph.png"
                alt=""
                width={28}
                height={28}
                className="lg:hidden h-7 w-7 object-contain"
              />
              <img
                src="/header-logo.svg"
                alt=""
                className="hidden lg:block h-[20px] w-auto"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-[40px]">
              {navigationItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href === "/liquidity" &&
                    pathname?.startsWith("/liquidity")) ||
                  (item.href === "/swap" && pathname?.startsWith("/swap")) ||
                  (item.href === "/vote" && pathname?.startsWith("/vote")) ||
                  (item.href === "/earn" && pathname?.startsWith("/earn")) ||
                  (item.href === "/portfolio" &&
                    pathname?.startsWith("/portfolio"));
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`relative whitespace-nowrap transition-colors ${
                      item.key === "myPortfolio" ? "hidden xl:block" : ""
                    } ${
                      isActive
                        ? "body-16-bold text-primary-100"
                        : "body-16-semibold text-gray-10 hover:text-white"
                    }`}
                  >
                    {t(`navigation.${item.key}`)}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 right-0 -bottom-[6px] h-[2px] bg-brand-green"
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right - Wallet and Settings */}
          <div className="flex items-center gap-[24px]">
            {isWrongNetwork && (
              <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-orange-100/10 text-orange-100 text-sm font-medium rounded-full border border-orange-100/20">
                <span>⚠️</span>
                <span>{t("common.switchToGiwaSepolia")}</span>
              </div>
            )}

            {/* Custom Connect Button Wrapper */}
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                if (!ready) {
                  return (
                    <div
                      aria-hidden={true}
                      style={{
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      }}
                    />
                  );
                }

                const connectButtonShadow =
                  "inset 0px 1px 1px 0px rgba(255,255,255,0.6), inset 0px -1px 2px 0px rgba(0,0,0,0.6)";

                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      type="button"
                      className="flex h-[40px] items-center justify-center px-[24px] xl:px-[50px] py-[10px] rounded-[29px] bg-brand-green body-16-bold text-black whitespace-nowrap hover:opacity-90 transition-all"
                      style={{ boxShadow: connectButtonShadow }}
                    >
                      {t("common.connectWallet")}
                    </button>
                  );
                }

                // Check if on wrong network (not GIWA Sepolia)
                const isUnsupportedChain = chain?.id !== GIWA_SEPOLIA_CHAIN_ID;

                const handleAccountClick = () => {
                  // If on unsupported chain, open chain modal to switch network
                  if (isUnsupportedChain && openChainModal) {
                    openChainModal();
                    return;
                  }
                  // Otherwise open account modal
                  if (openAccountModal) {
                    openAccountModal();
                  }
                };

                return (
                  <button
                    onClick={handleAccountClick}
                    type="button"
                    className={`flex h-[40px] items-center justify-center gap-[10px] px-[50px] py-[10px] rounded-[29px] body-16-bold whitespace-nowrap hover:opacity-90 transition-all ${
                      isUnsupportedChain
                        ? "bg-orange-100 text-white"
                        : "bg-brand-green text-[#1a1717]"
                    }`}
                    style={{ boxShadow: connectButtonShadow }}
                  >
                    {isUnsupportedChain ? (
                      <>
                        <span>⚠️</span>
                        <span>{t("common.wrongNetwork")}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center justify-center size-[24px] rounded-full bg-white shrink-0">
                          <img
                            src="/logo.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-[14px]"
                            style={{ filter: "brightness(0)" }}
                          />
                        </span>
                        {account.displayName}
                      </>
                    )}
                  </button>
                );
              }}
            </ConnectButton.Custom>

            {/* Settings - desktop only */}
            <button
              onClick={openSettings}
              aria-label="Open settings"
              className="hidden xl:flex items-center justify-center p-[8px] rounded-full bg-gray-80 text-gray-10 hover:text-white transition-colors"
              style={{
                boxShadow:
                  "inset 0px -1px 1px 0px rgba(0,0,0,0.35), inset 0px 1px 1px 0px rgba(255,255,255,0.25)",
              }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>

            {/* Hamburger - mobile/tablet only */}
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="xl:hidden flex items-center justify-center p-[8px] rounded-full bg-gray-80 text-gray-10 hover:text-white transition-colors"
              style={{
                boxShadow:
                  "inset 0px -1px 1px 0px rgba(0,0,0,0.35), inset 0px 1px 1px 0px rgba(255,255,255,0.25)",
              }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu — Figma 1457:36841 */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-3 flex justify-end">
            <div
              className="w-[197px] rounded-[10px] px-2.5 pt-2.5 pb-5 flex flex-col gap-5 items-center justify-center"
              style={{
                // Figma 1457:36841 ships stops at 326.84% / 140% (both
                // outside the visible 0%-100% range), which CSS clamps to
                // a flat light gray and inverts the designer's intent.
                // Reproduce the rendered dark panel with stops in-range.
                background:
                  "linear-gradient(180deg, #3a3a3a 0%, #1a1a1a 100%)",
              }}
            >
              <nav className="flex flex-col gap-4 items-center justify-center w-full">
                {navigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/liquidity" &&
                      pathname?.startsWith("/liquidity")) ||
                    (item.href === "/swap" &&
                      pathname?.startsWith("/swap")) ||
                    (item.href === "/vote" &&
                      pathname?.startsWith("/vote")) ||
                    (item.href === "/earn" &&
                      pathname?.startsWith("/earn")) ||
                    (item.href === "/portfolio" &&
                      pathname?.startsWith("/portfolio"));
                  const iconName = dropdownNavIcons[item.key];
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={
                        isActive
                          ? "flex items-center justify-center gap-1 w-full px-2.5 py-2.5 rounded-[10px] bg-brand-green text-black body-14-bold whitespace-nowrap"
                          : "flex items-center gap-1 text-white body-16-semibold whitespace-nowrap hover:opacity-80 transition-opacity"
                      }
                    >
                      {iconName && <NavIcon name={iconName} />}
                      <span>{t(`mobileNav.${item.key}`)}</span>
                    </Link>
                  );
                })}
              </nav>
              <div className="h-px w-full bg-white/30" />
              <button
                type="button"
                disabled
                className="text-white body-16-semibold whitespace-nowrap cursor-not-allowed opacity-90"
              >
                {t("common.language")}
              </button>
              <div className="h-px w-full bg-white/30" />
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openSettings();
                }}
                className="text-white body-16-semibold whitespace-nowrap hover:opacity-80 transition-opacity"
              >
                {t("settings.title")}
              </button>
              <div className="h-px w-full bg-white/30" />
              <button
                type="button"
                disabled
                className="text-white body-16-semibold whitespace-nowrap cursor-not-allowed opacity-90"
              >
                {t("common.about")}
              </button>
            </div>
          </div>
        )}

        {/* Mobile Network Warning */}
        {isWrongNetwork && (
          <div className="xl:hidden mt-3">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-100/10 text-orange-100 text-sm font-medium rounded-lg border border-orange-100/20">
              <span>⚠️</span>
              <span>{t("common.switchToGiwaSepolia")}</span>
            </div>
          </div>
        )}
      </div>

      <SettingsModal />
    </header>
  );
}
