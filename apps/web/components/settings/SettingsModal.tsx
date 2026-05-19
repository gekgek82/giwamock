"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDisconnect } from "wagmi";
import toast from "react-hot-toast";
import { useSettingsStore } from "@/lib/store";
import { GIWASCAN_URL } from "@/lib/config";

const DEADLINE_PRESETS = [10, 30, 300];

export function SettingsModal() {
  const t = useTranslations();
  const { disconnect } = useDisconnect();
  const {
    isSettingsOpen,
    closeSettings,
    currency,
    setCurrency,
    deadlineMinutes,
    setDeadlineMinutes,
    customRpcUrl,
    setCustomRpcUrl,
  } = useSettingsStore();

  // Local state for editing (commit on Save)
  const [localCurrency, setLocalCurrency] = useState(currency);
  const [localDeadline, setLocalDeadline] = useState(deadlineMinutes);
  const [localCustomDeadline, setLocalCustomDeadline] = useState("");
  const [localRpcUrl, setLocalRpcUrl] = useState(customRpcUrl);

  // Sync local state when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setLocalCurrency(currency);
      setLocalDeadline(deadlineMinutes);
      setLocalCustomDeadline("");
      setLocalRpcUrl(customRpcUrl);
    }
  }, [isSettingsOpen, currency, deadlineMinutes, customRpcUrl]);

  if (!isSettingsOpen) return null;

  const isCustomDeadline = !DEADLINE_PRESETS.includes(localDeadline);

  const handlePresetDeadline = (minutes: number) => {
    setLocalDeadline(minutes);
    setLocalCustomDeadline("");
  };

  const handleCustomDeadlineChange = (value: string) => {
    if (value === "" || /^\d*$/.test(value)) {
      setLocalCustomDeadline(value);
      if (value && !isNaN(parseInt(value))) {
        setLocalDeadline(parseInt(value));
      }
    }
  };

  const handleAddRpc = () => {
    if (!localRpcUrl.trim()) return;
    try {
      new URL(localRpcUrl.trim());
    } catch {
      toast.error(t("settings.invalidRpcUrl"));
      return;
    }
    setCustomRpcUrl(localRpcUrl.trim());
    toast.success(t("settings.rpcSaved"));
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success(t("settings.disconnected"));
    closeSettings();
  };

  const handleSave = () => {
    setCurrency(localCurrency);
    setDeadlineMinutes(localDeadline);
    if (localRpcUrl.trim() && localRpcUrl !== customRpcUrl) {
      try {
        new URL(localRpcUrl.trim());
        setCustomRpcUrl(localRpcUrl.trim());
      } catch {
        // ignore invalid URL on save
      }
    }
    closeSettings();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center"
        onClick={closeSettings}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-primary-700 heading-6">
              {t("settings.title")}
            </h3>
            <button
              onClick={closeSettings}
              className="text-neutral-600 hover:text-neutral-900 transition-all"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="h-px w-full bg-gray-30 mb-6" />

          {/* Currency Setting */}
          <div className="mb-6">
            <p className="text-neutral-1000 body-16-semibold mb-3">
              {t("settings.currencySetting")}
            </p>
            <div className="border border-neutral-300 rounded-full p-1 flex">
              {(["KRW", "USD"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setLocalCurrency(c)}
                  className={`flex-1 py-2.5 rounded-full body-14-medium transition-all ${
                    localCurrency === c
                      ? "bg-primary-700 text-white"
                      : "text-neutral-700 hover:text-neutral-900"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Swap Setting - Transaction Deadline */}
          <div className="mb-6">
            <p className="text-neutral-1000 body-16-semibold mb-1">
              {t("settings.swapSetting")}
            </p>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-neutral-700 body-14">
                {t("settings.transactionDeadline")}
              </span>
              <div className="group relative">
                <svg
                  className="w-4 h-4 text-neutral-500 cursor-help"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 text-center z-10">
                  {t("settings.deadlineTooltip")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="border border-neutral-300 rounded-full p-1 flex flex-1">
                {DEADLINE_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => handlePresetDeadline(minutes)}
                    className={`flex-1 py-2 rounded-full body-14-medium transition-all ${
                      localDeadline === minutes && !localCustomDeadline
                        ? "bg-primary-700 text-white"
                        : "text-neutral-700 hover:text-neutral-900"
                    }`}
                  >
                    {minutes}
                    {t("settings.minutes")}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-500 body-14">
                  {t("settings.custom")}
                </span>
                <div className="flex items-center bg-neutral-200 rounded-lg px-3 py-2 w-20">
                  <input
                    type="text"
                    value={
                      localCustomDeadline ||
                      (isCustomDeadline ? String(localDeadline) : "")
                    }
                    onChange={(e) => handleCustomDeadlineChange(e.target.value)}
                    placeholder="30"
                    className="w-full bg-transparent text-neutral-1000 body-14 outline-none text-right"
                  />
                  <span className="text-neutral-500 body-14 ml-1">
                    {t("settings.minutes")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Custom RPCs */}
          <div className="mb-6">
            <div className="flex items-center gap-1 mb-3">
              <p className="text-neutral-1000 body-16-semibold">
                {t("settings.customRpcs")}
              </p>
              <div className="group relative">
                <svg
                  className="w-4 h-4 text-neutral-500 cursor-help"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-48 text-center z-10">
                  {t("settings.rpcTooltip")}
                </div>
              </div>
            </div>
            <div className="mb-3">
              <span className="inline-block px-4 py-1.5 border border-neutral-300 rounded-full text-neutral-700 body-14-medium bg-neutral-100">
                GIWA Sepolia
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localRpcUrl}
                onChange={(e) => setLocalRpcUrl(e.target.value)}
                placeholder={t("settings.rpcUrl")}
                className="flex-1 bg-neutral-200 rounded-xl px-4 py-3 text-neutral-1000 body-14 outline-none placeholder:text-neutral-500"
              />
              <button
                onClick={handleAddRpc}
                className="px-5 py-3 bg-neutral-1000 text-white rounded-xl body-14-medium hover:opacity-90 transition-all"
              >
                {t("common.add")}
              </button>
            </div>
          </div>

          {/* Blockchain Explorer */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-neutral-1000 body-16-semibold">
              {t("settings.blockExplorer")}
            </p>
            <button
              onClick={() => window.open(GIWASCAN_URL, "_blank")}
              className="px-5 py-2 bg-primary-700 text-white rounded-xl body-14-medium hover:opacity-90 transition-all"
            >
              {t("settings.viewNow")}
            </button>
          </div>

          {/* Wallet */}
          <div className="flex items-center justify-between mb-8">
            <p className="text-neutral-1000 body-16-semibold">
              {t("settings.wallet")}
            </p>
            <button
              onClick={handleDisconnect}
              className="px-5 py-2 bg-primary-700 text-white rounded-xl body-14-medium hover:opacity-90 transition-all"
            >
              {t("settings.disconnect")}
            </button>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full py-3.5 bg-neutral-1000 text-white rounded-xl body-16-semibold hover:opacity-90 transition-all"
          >
            {t("settings.save")}
          </button>
        </div>
      </div>
    </>
  );
}
