import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Calendar,
  Settings,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { calculateNetWorthBreakdown, formatVNDShort } from '../utils/formatters';

interface HeaderProps {
  onOpenQuickScan?: () => void;
  onOpenQuickAdd?: () => void;
  onOpenSettings?: () => void;
  onOpenAccountSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQuickScan,
  onOpenSettings,
  onOpenAccountSync,
}) => {
  const { currentMonth, shiftMonth, data, togglePrivacyMask, syncStatus } = useFinance();
  const { user } = useAuth();
  const netWorthData = calculateNetWorthBreakdown(data);

  const [yearStr, monthStr] = currentMonth.split('-');
  const monthLabel = `Tháng ${Number(monthStr)}/${yearStr}`;

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5">
        {/* MOBILE VIEW (< 640px): 2 clean spacious rows, zero overlap */}
        <div className="sm:hidden space-y-2">
          {/* Row 1: Brand Logo + Sổ Thu Chi + Net worth preview & Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src="./app-icon.png?v=3"
                alt="Sổ Thu Chi"
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-xl object-cover shadow-xs shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight truncate">
                  {data.settings.ledgerName || 'Sổ Thu Chi'}
                </h1>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1">
                  <span>Tài sản:</span>
                  <span className="money-mask font-bold text-slate-800 dark:text-slate-200">
                    {formatVNDShort(netWorthData.netWorth)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Buttons: Cloud Account + Eye + Settings */}
            <div className="flex items-center gap-1.5 shrink-0">
              {onOpenAccountSync && (
                <button
                  type="button"
                  onClick={onOpenAccountSync}
                  className={`h-9 px-2.5 rounded-xl flex items-center gap-1.5 border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                    user
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                  }`}
                  title={user ? `Đã đăng nhập: ${user.email}` : 'Đăng nhập đồng bộ điện thoại & máy tính'}
                >
                  {user ? (
                    <>
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="User"
                          className="w-5 h-5 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">
                          {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                      {syncStatus === 'syncing' ? (
                        <RefreshCw size={12} className="animate-spin text-amber-500" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </>
                  ) : (
                    <>
                      <Cloud size={14} />
                      <span>Đăng nhập</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={togglePrivacyMask}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
                  data.settings.privacyMask
                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
                title={data.settings.privacyMask ? 'Bấm để hiện số tiền' : 'Bấm để ẩn số tiền'}
              >
                {data.settings.privacyMask ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>

              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                  title="Mở Cài đặt"
                >
                  <Settings size={17} />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Month Navigator full width on mobile */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => shiftMonth(-1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 active:scale-95 transition-all"
              title="Tháng trước"
            >
              <ChevronLeft size={19} />
            </button>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
              <Calendar size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{monthLabel}</span>
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 active:scale-95 transition-all"
              title="Tháng sau"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </div>

        {/* DESKTOP VIEW (>= 640px): 1 single horizontal row */}
        <div className="hidden sm:flex items-center justify-between gap-3">
          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="./app-icon.png?v=3"
              alt="Sổ Thu Chi"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-2xl object-cover shadow-md shadow-emerald-500/20 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate flex items-center gap-1.5">
                <span>{data.settings.ledgerName || 'Sổ Thu Chi'}</span>
              </h1>
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Tài sản ròng:</span>
                <span className="money-mask font-semibold text-slate-800 dark:text-slate-200">
                  {formatVNDShort(netWorthData.netWorth)}
                </span>
              </div>
            </div>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={() => shiftMonth(-1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all"
              title="Tháng trước"
            >
              <ChevronLeft size={19} />
            </button>
            <div className="px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 min-w-[7.5rem] justify-center">
              <Calendar size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{monthLabel}</span>
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 transition-all"
              title="Tháng sau"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {onOpenAccountSync && (
              <button
                type="button"
                onClick={onOpenAccountSync}
                className={`h-10 px-3.5 rounded-xl flex items-center gap-2 border text-xs font-bold active:scale-95 transition-all cursor-pointer ${
                  user
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white border-transparent shadow-sm'
                }`}
                title={user ? `Đã đồng bộ: ${user.email}` : 'Đăng nhập Google để đồng bộ đa thiết bị'}
              >
                {user ? (
                  <>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-5 h-5 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="max-w-[90px] truncate hidden md:inline">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    {syncStatus === 'syncing' ? (
                      <RefreshCw size={12} className="animate-spin text-amber-500" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </>
                ) : (
                  <>
                    <Cloud size={15} />
                    <span>Đăng nhập</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={togglePrivacyMask}
              className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all active:scale-95 ${
                data.settings.privacyMask
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={data.settings.privacyMask ? 'Đang ẩn số tiền' : 'Bấm để ẩn số tiền'}
            >
              {data.settings.privacyMask ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all"
                title="Cài đặt"
              >
                <Settings size={18} />
              </button>
            )}

            {onOpenQuickScan && (
              <button
                onClick={onOpenQuickScan}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm shadow-indigo-500/25 active:scale-95 transition-all"
              >
                <Sparkles size={15} />
                <span>Quét AI</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
