"use client";

import { useTranslations } from "next-intl";
import { CheckBox } from "./icons";
import { SectionHeading } from "./SectionHeading";
import type { PoolCategory } from "./types";

interface PoolModelOptionProps {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function PoolModelOption({
  title,
  description,
  selected,
  onClick,
}: PoolModelOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 bg-gray-20 rounded-[40px] px-6 py-5 flex flex-col items-center justify-center gap-2.5 text-center transition-colors ${
        selected
          ? "border-2 border-primary-200"
          : "border-2 border-transparent hover:border-gray-30"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <CheckBox checked={selected} />
        <span className="heading-6 text-gray-100">{title}</span>
      </div>
      <p
        className={`body-16 text-gray-100 ${
          selected ? "font-semibold" : "font-medium"
        }`}
      >
        {description}
      </p>
    </button>
  );
}

export interface SelectPoolModelSectionProps {
  poolCategory: PoolCategory;
  onSelect: (category: NonNullable<PoolCategory>) => void;
}

export function SelectPoolModelSection({
  poolCategory,
  onSelect,
}: SelectPoolModelSectionProps) {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{t("launchPool.selectPoolModel")}</SectionHeading>
      <div className="bg-white rounded-[40px] p-5 flex flex-col md:flex-row gap-5 items-stretch">
        <PoolModelOption
          title={t("launchPool.basicPool")}
          description={t("launchPool.basicPoolDescription")}
          selected={poolCategory === "basic"}
          onClick={() => onSelect("basic")}
        />
        <PoolModelOption
          title={t("launchPool.concentratedPool")}
          description={t("launchPool.concentratedPoolDescription")}
          selected={poolCategory === "cl"}
          onClick={() => onSelect("cl")}
        />
      </div>
    </section>
  );
}
