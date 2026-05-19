import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SwapState {
  slippage: number;
  setSlippage: (slippage: number) => void;
}

export const useSwapStore = create<SwapState>((set) => ({
  slippage: 0.5,
  setSlippage: (slippage) => set({ slippage: slippage > 0 ? slippage : 0.01 }),
}));

interface SettingsState {
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  currency: 'KRW' | 'USD';
  setCurrency: (currency: 'KRW' | 'USD') => void;
  deadlineMinutes: number;
  setDeadlineMinutes: (minutes: number) => void;
  customRpcUrl: string;
  setCustomRpcUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isSettingsOpen: false,
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      currency: 'USD',
      setCurrency: (currency) => set({ currency }),
      deadlineMinutes: 20,
      setDeadlineMinutes: (minutes) =>
        set({ deadlineMinutes: Math.min(Math.max(minutes, 1), 4320) }),
      customRpcUrl: '',
      setCustomRpcUrl: (url) => set({ customRpcUrl: url }),
    }),
    {
      name: 'giwater-settings',
      partialize: (state) => ({
        currency: state.currency,
        deadlineMinutes: state.deadlineMinutes,
        customRpcUrl: state.customRpcUrl,
      }),
    }
  )
);

export function getDeadlineTimestamp(deadlineMinutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);
}
