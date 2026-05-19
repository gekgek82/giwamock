"use client";

import { useState } from "react";
import Image from "next/image";
import { type TokenInfo } from "@/hooks/useContractAddresses";
import { TokenIcon } from "@/components/common/TokenIcon";
import { TokenSelectModal } from "./TokenSelectModal";

interface TokenSelectProps {
  selectedToken?: TokenInfo;
  onSelect: (token: TokenInfo) => void;
  /** visual size: "md" for desktop (p-4), "sm" for mobile (p-1.5). Defaults to "md". */
  size?: "md" | "sm";
}

export function TokenSelect({
  selectedToken,
  onSelect,
  size = "md",
}: TokenSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isSm = size === "sm";
  const wrapperClass = isSm
    ? "flex items-center gap-1.5 p-1.5 bg-white rounded-full transition-colors hover:bg-gray-10"
    : "flex items-center gap-2.5 p-4 bg-white rounded-full transition-colors hover:bg-gray-10";
  const symbolClass = isSm
    ? "body-14-bold text-gray-90 flex items-center gap-1"
    : "body-16-semibold text-gray-90 flex items-center gap-1";
  const placeholderClass = isSm
    ? "body-14-bold text-gray-50"
    : "body-16-semibold text-gray-50";

  return (
    <>
      <button onClick={() => setIsOpen(true)} className={wrapperClass}>
        {selectedToken ? (
          <>
            <TokenIcon
              address={selectedToken.address}
              symbol={selectedToken.symbol}
              iconUrl={selectedToken.iconUrl}
              size={24}
            />
            <span className={symbolClass}>
              {selectedToken.symbol}
              {selectedToken.stickerUrl && (
                <Image
                  src={selectedToken.stickerUrl}
                  alt="sticker"
                  width={18}
                  height={18}
                  className="object-contain"
                />
              )}
            </span>
          </>
        ) : (
          <span className={placeholderClass}>---</span>
        )}
        <svg
          className="w-6 h-6 text-gray-90"
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

      <TokenSelectModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={(token) => {
          onSelect(token);
          setIsOpen(false);
        }}
      />
    </>
  );
}
