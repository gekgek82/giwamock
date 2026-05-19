"use client";

import { useState } from "react";
import { useTokenByAddress } from "@/hooks/useContractAddresses";

interface TokenIconProps {
  /** Token address to look up icon from API */
  address?: string;
  /** Token symbol for fallback display */
  symbol: string;
  /** Token icon URL (optional, overrides API lookup) */
  iconUrl?: string | null;
  /** Icon size in pixels (default: 32) */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TokenIcon Component
 *
 * Displays token icon from API iconUrl with fallback support.
 * Falls back to symbol-based default icons or first letter.
 *
 * @example
 * ```tsx
 * // Using address (looks up iconUrl from API)
 * <TokenIcon address="0x..." symbol="USDC" />
 *
 * // Using direct iconUrl
 * <TokenIcon symbol="TER" iconUrl="https://cdn.example.com/ter.png" />
 *
 * // Custom size
 * <TokenIcon address="0x..." symbol="ETH" size={48} />
 * ```
 */
export function TokenIcon({
  address,
  symbol,
  iconUrl,
  size = 32,
  className = "",
}: TokenIconProps) {
  const [imgError, setImgError] = useState(false);

  // Look up token from API if address provided and no direct iconUrl
  const tokenFromApi = useTokenByAddress(address);
  const resolvedIconUrl = iconUrl ?? tokenFromApi?.iconUrl;

  // Use a plain <img> so arbitrary catalog URLs (not in next.config `images.remotePatterns`)
  // do not hit `/_next/image` and return 400.
  if (resolvedIconUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedIconUrl}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: Built-in icons for common tokens
  const upperSymbol = symbol.toUpperCase();

  if (upperSymbol === "ETH" || upperSymbol === "WETH") {
    return (
      <div
        className={`bg-[#627EEA] rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          className="text-white"
          style={{ width: size * 0.6, height: size * 0.6 }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 1.5L5.5 12.25L12 16L18.5 12.25L12 1.5ZM12 17.5L5.5 13.5L12 22.5L18.5 13.5L12 17.5Z" />
        </svg>
      </div>
    );
  }

  if (
    upperSymbol === "USDC" ||
    upperSymbol === "USDT" ||
    upperSymbol === "DAI"
  ) {
    return (
      <div
        className={`bg-[#2775CA] rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
          $
        </span>
      </div>
    );
  }

  if (
    upperSymbol === "BTC" ||
    upperSymbol === "WBTC" ||
    upperSymbol === "CBBTC"
  ) {
    return (
      <div
        className={`bg-[#F7931A] rounded-full flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          className="text-white"
          style={{ width: size * 0.6, height: size * 0.6 }}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
        </svg>
      </div>
    );
  }

  // Default fallback: generic token image
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/token/default.png"
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
    />
  );
}

/**
 * TokenPairIcon Component
 *
 * Displays two token icons stacked/overlapped for pool display.
 *
 * @example
 * ```tsx
 * <TokenPairIcon
 *   leftAddress="0x..."
 *   leftSymbol="ETH"
 *   rightAddress="0x..."
 *   rightSymbol="USDC"
 * />
 * ```
 */
export function TokenPairIcon({
  leftAddress,
  leftSymbol,
  leftIconUrl,
  rightAddress,
  rightSymbol,
  rightIconUrl,
  size = 32,
  className = "",
}: {
  leftAddress?: string;
  leftSymbol: string;
  leftIconUrl?: string | null;
  rightAddress?: string;
  rightSymbol: string;
  rightIconUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center ${className}`}>
      <TokenIcon
        address={leftAddress}
        symbol={leftSymbol}
        iconUrl={leftIconUrl}
        size={size}
      />
      <TokenIcon
        address={rightAddress}
        symbol={rightSymbol}
        iconUrl={rightIconUrl}
        size={size}
        className="-ml-2"
      />
    </div>
  );
}
