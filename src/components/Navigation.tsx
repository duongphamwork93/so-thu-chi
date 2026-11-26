import React from 'react';
import { Home, ReceiptText, Plus, Landmark, LayoutGrid } from 'lucide-react';

export type TabKey = 'home' | 'ledger' | 'report' | 'more' | 'assets' | 'ai' | 'settings';

interface NavigationProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  onOpenAddModal: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, onOpenAddModal }) => {
  // Map subviews like 'ai', 'settings' to 'more' tab highlight
  const isMoreActive = activeTab === 'more' || activeTab === 'ai' || activeTab === 'settings';
  const isHomeActive = activeTab === 'home' || activeTab === 'report';
  const isAssetsActive = activeTab === 'assets';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 shadow-2xl transition-colors pb-[env(safe-area-inset-bottom,6px)]">
      <div className="max-w-md mx-auto px-2 h-[68px] grid grid-cols-5 items-center relative">
        {/* 1. Tổng quan & Báo cáo (Home) */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl min-h-[50px] transition-all duration-150 cursor-pointer ${
            isHomeActive
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isHomeActive ? 'bg-emerald-50 dark:bg-emerald-950/60 scale-105' : ''}`}>
            <Home size={22} strokeWidth={isHomeActive ? 2.5 : 2} />
          </div>
          <span className="text-[11px] font-bold mt-0.5 leading-tight truncate">Tổng quan</span>
        </button>

        {/* 2. Sổ thu chi (Ledger) */}
        <button
          type="button"
          onClick={() => onTabChange('ledger')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl min-h-[50px] transition-all duration-150 cursor-pointer ${
            activeTab === 'ledger'
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${activeTab === 'ledger' ? 'bg-emerald-50 dark:bg-emerald-950/60 scale-105' : ''}`}>
            <ReceiptText size={22} strokeWidth={activeTab === 'ledger' ? 2.5 : 2} />
          </div>
          <span className="text-[11px] font-bold mt-0.5 leading-tight truncate">Sổ thu chi</span>
        </button>

        {/* 3. CENTER HERO BUTTON: Ghi sổ (+) */}
        <div className="flex flex-col items-center justify-center relative -top-3">
          <button
            type="button"
            onClick={onOpenAddModal}
            className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-emerald-400/35 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-emerald-400/25 cursor-pointer"
            title="Thêm giao dịch mới nhanh"
          >
            <Plus size={26} strokeWidth={2.8} />
          </button>
          <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5 leading-tight tracking-tight">
            Ghi sổ
          </span>
        </div>

        {/* 4. Tài sản & Nợ (Assets) */}
        <button
          type="button"
          onClick={() => onTabChange('assets')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl min-h-[50px] transition-all duration-150 cursor-pointer ${
            isAssetsActive
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isAssetsActive ? 'bg-emerald-50 dark:bg-emerald-950/60 scale-105' : ''}`}>
            <Landmark size={22} strokeWidth={isAssetsActive ? 2.5 : 2} />
          </div>
          <span className="text-[11px] font-bold mt-0.5 leading-tight truncate">Tài sản</span>
        </button>

        {/* 5. Khác & Tiện ích (More / AI / Settings) */}
        <button
          type="button"
          onClick={() => onTabChange('more')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-2xl min-h-[50px] transition-all duration-150 cursor-pointer ${
            isMoreActive
              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <div className={`p-1 rounded-xl transition-all ${isMoreActive ? 'bg-emerald-50 dark:bg-emerald-950/60 scale-105' : ''}`}>
            <LayoutGrid size={22} strokeWidth={isMoreActive ? 2.5 : 2} />
          </div>
          <span className="text-[11px] font-bold mt-0.5 leading-tight truncate">Khác</span>
        </button>
      </div>
    </nav>
  );
};
