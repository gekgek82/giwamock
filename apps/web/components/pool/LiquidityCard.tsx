'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AddLiquidity } from './AddLiquidity';
import { RemoveLiquidity } from './RemoveLiquidity';

export function LiquidityCard() {
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const t = useTranslations();

  return (
    <div className="card p-6 sm:p-8 animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-2">
        <span>💧</span>
        {t('liquidity.title')}
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b-2 border-slate-200">
        <button
          onClick={() => setActiveTab('add')}
          className={`px-6 py-3 font-bold transition-all rounded-t-lg ${
            activeTab === 'add'
              ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/50 -mb-0.5'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          ➕ {t('liquidity.addLiquidity')}
        </button>
        <button
          onClick={() => setActiveTab('remove')}
          className={`px-6 py-3 font-bold transition-all rounded-t-lg ${
            activeTab === 'remove'
              ? 'text-blue-600 border-b-4 border-blue-600 bg-blue-50/50 -mb-0.5'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          ➖ {t('liquidity.removeLiquidity')}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'add' ? <AddLiquidity /> : <RemoveLiquidity />}
    </div>
  );
}

