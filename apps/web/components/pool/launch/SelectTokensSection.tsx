"use client";

import { useTranslations } from "next-intl";
import { TokenIcon } from "@/components/common/TokenIcon";
import { TokenSelectModal } from "@/components/swap/TokenSelectModal";
import type { TokenInfo } from "@/hooks/useContractAddresses";
import { ChevronDown } from "./icons";
import { SectionHeading } from "./SectionHeading";

interface TokenSelectCardProps {
  title: string;
  token: TokenInfo | null;
  onOpen: () => void;
  placeholder: string;
}

function TokenSelectCard({
  title,
  token,
  onOpen,
  placeholder,
}: TokenSelectCardProps) {
  return (
    <div className="bg-white rounded-[40px] flex flex-col gap-5 pb-[30px] flex-1">
      <div className="flex flex-col gap-3 pt-[30px]">
        <div className="px-[30px]">
          <p className="heading-6 text-gray-100">{title}</p>
        </div>
        <div className="border-t border-gray-20" />
      </div>
      <div className="px-[30px]">
        <button
          type="button"
          onClick={onOpen}
          className="w-full bg-gray-20 hover:bg-gray-30 rounded-[100px] px-[30px] py-4 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-1.5">
            {token ? (
              <>
                <TokenIcon
                  address={token.address}
                  symbol={token.symbol}
                  iconUrl={token.iconUrl}
                  size={24}
                />
                <span className="heading-6 text-gray-100">{token.symbol}</span>
              </>
            ) : (
              <span className="heading-6 text-gray-100">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="w-6 h-6 text-gray-100" />
        </button>
      </div>
    </div>
  );
}

export interface SelectTokensSectionProps {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  isToken0ModalOpen: boolean;
  isToken1ModalOpen: boolean;
  onOpenToken0: () => void;
  onOpenToken1: () => void;
  onCloseToken0: () => void;
  onCloseToken1: () => void;
  onSelectToken0: (token: TokenInfo) => void;
  onSelectToken1: (token: TokenInfo) => void;
}

export function SelectTokensSection({
  token0,
  token1,
  isToken0ModalOpen,
  isToken1ModalOpen,
  onOpenToken0,
  onOpenToken1,
  onCloseToken0,
  onCloseToken1,
  onSelectToken0,
  onSelectToken1,
}: SelectTokensSectionProps) {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{t("launchPool.selectTokensTitle")}</SectionHeading>
      <div className="flex flex-col md:flex-row items-stretch gap-5">
        <TokenSelectCard
          title={t("launchPool.tokenToDeposit")}
          token={token0}
          onOpen={onOpenToken0}
          placeholder={t("launchPool.selectToken")}
        />
        <TokenSelectCard
          title={t("launchPool.tokenToPairWith")}
          token={token1}
          onOpen={onOpenToken1}
          placeholder={t("launchPool.selectToken")}
        />
      </div>
      <TokenSelectModal
        isOpen={isToken0ModalOpen}
        onClose={onCloseToken0}
        onSelect={onSelectToken0}
        excludeToken={token1?.address}
      />
      <TokenSelectModal
        isOpen={isToken1ModalOpen}
        onClose={onCloseToken1}
        onSelect={onSelectToken1}
        excludeToken={token0?.address}
      />
    </section>
  );
}
