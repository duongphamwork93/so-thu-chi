import React from 'react';
import {
  Landmark,
  Bot,
  Settings as SettingsIcon,
  Tag,
  Target,
  Download,
  Shield,
  CreditCard,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Rocket,
  Github,
  Cloud,
  CheckCircle2,
  RefreshCw,
  Palette,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { formatVNDShort } from '../../utils/formatters';
import { getColorThemeOption } from '../../constants/themes';

interface MoreHubViewProps {
  onNavigateSub: (sub: 'assets' | 'ai' | 'settings') => void;
  onOpenAddModal: () => void;
  onOpenGitHubModal?: () => void;
  onOpenAccountSync?: () => void;
}

export const MoreHubView: React.FC<MoreHubViewProps> = ({
  onNavigateSub,
  onOpenAddModal,
  onOpenGitHubModal,
  onOpenAccountSync,
}) => {
  const { data, customCategories, syncStatus } = useFinance();
  const { user } = useAuth();

  const totalBalance = data.accts.reduce((sum, a) => sum + a.balance, 0);
  const activeColorTheme = getColorThemeOption(data.settings.colorTheme);

  return (
    <div className="space-y-4 pb-36">
      {/* Header Profile / Ledger Title Card */}
      <div className="bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-slate-900 dark:via-emerald-950/40 dark:to-slate-900 text-slate-900 dark:text-white rounded-3xl p-5 shadow-sm border border-emerald-200/90 dark:border-emerald-800/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="./app-icon.png?v=3"
              alt="Sổ Thu Chi"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover shadow-sm shrink-0"
            />
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {data.settings.ledgerName || 'Sổ Thu Chi'}
              </h2>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                Tài khoản & Tiện ích mở rộng
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateSub('settings')}
            className="w-9 h-9 rounded-xl bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20 border border-emerald-200/80 dark:border-white/15 flex items-center justify-center text-emerald-700 dark:text-white transition-all active:scale-95 shadow-xs"
            title="Mở Cài đặt"
          >
            <SettingsIcon size={17} />
          </button>
        </div>

        <div className="pt-2 border-t border-emerald-200/70 dark:border-white/10 flex items-center justify-between text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">Tổng số dư các tài khoản ví:</span>
          <span className="font-extrabold text-sm sm:text-base text-emerald-700 dark:text-emerald-300 money-mask">
            {formatVNDShort(totalBalance)}
          </span>
        </div>

        {onOpenAccountSync && (
          <button
            type="button"
            onClick={onOpenAccountSync}
            className="w-full py-2.5 px-3.5 rounded-2xl bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 border border-emerald-200/80 dark:border-white/15 flex items-center justify-between gap-2 text-left transition-all active:scale-[0.99] cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user ? (
                <>
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="User"
                      className="w-7 h-7 rounded-full object-cover border border-emerald-400 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Cloud size={16} className="text-emerald-600 dark:text-emerald-300 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.email}</p>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1 font-semibold">
                      {syncStatus === 'syncing' ? (
                        <>
                          <RefreshCw size={10} className="animate-spin" />
                          <span>Đang đồng bộ...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={10} />
                          <span>Đang đồng bộ Đám mây Điện thoại & Máy tính</span>
                        </>
                      )}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Cloud size={17} className="text-emerald-600 dark:text-emerald-300 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Đăng nhập Google để đồng bộ</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-300 truncate">
                      Dùng chung 1 dữ liệu trên Điện thoại & Máy tính
                    </p>
                  </div>
                </>
              )}
            </div>
            <ChevronRight size={15} className="text-emerald-600 dark:text-slate-300 shrink-0" />
          </button>
        )}
      </div>

      {/* Primary Feature Hub (MISA Grid Style) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
          Tính Năng & Quản Lý
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* 1. Tài sản & Nợ */}
          <button
            type="button"
            onClick={() => onNavigateSub('assets')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all text-left flex flex-col justify-between h-32 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Landmark size={20} strokeWidth={2.4} />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                <span>Tài Sản & Nợ</span>
                <ChevronRight size={15} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Chứng khoán, Vàng, Tiết kiệm, Nợ
              </p>
            </div>
          </button>

          {/* 2. Trợ lý AI */}
          <button
            type="button"
            onClick={() => onNavigateSub('ai')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-violet-500/50 hover:shadow-md transition-all text-left flex flex-col justify-between h-32 active:scale-95 cursor-pointer group relative overflow-hidden"
          >
            <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bot size={20} strokeWidth={2.4} />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                <span>Trợ Lý AI</span>
                <ChevronRight size={15} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Quét hóa đơn chụp ảnh bằng AI
              </p>
            </div>
            <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-violet-600 text-white leading-tight">
              AI
            </span>
          </button>

          {/* 3. Cài đặt hệ thống */}
          <button
            type="button"
            onClick={() => onNavigateSub('settings')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-cyan-500/50 hover:shadow-md transition-all text-left flex flex-col justify-between h-32 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <SettingsIcon size={20} strokeWidth={2.4} />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                <span>Cài Đặt & Tên Sổ</span>
                <ChevronRight size={15} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                Đổi tên sổ, ngân sách & bảo mật
              </p>
            </div>
          </button>

          {/* 4. Quản lý danh mục */}
          <button
            type="button"
            onClick={() => onNavigateSub('settings')}
            className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-amber-500/50 hover:shadow-md transition-all text-left flex flex-col justify-between h-32 active:scale-95 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Tag size={20} strokeWidth={2.4} />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                <span>Danh Mục Thu Chi</span>
                <ChevronRight size={15} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {customCategories.length > 0 ? `${customCategories.length} loại tự tạo` : 'Tạo loại giao dịch riêng'}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Quick Settings & Security Highlights */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Tiện Ích & Sao Lưu
        </h4>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div
            onClick={() => onNavigateSub('settings')}
            className="py-3 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${activeColorTheme.swatchHex}, ${activeColorTheme.secondaryHex})`,
                }}
              >
                <Palette size={15} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Giao Diện & Màu Sắc
                </p>
                <p className="text-[11px] text-slate-400">
                  Đang dùng: {activeColorTheme.name} ·{' '}
                  {data.settings.theme === 'dark'
                    ? 'Tối'
                    : data.settings.theme === 'system'
                    ? 'Theo máy'
                    : 'Sáng'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          <div
            onClick={() => onNavigateSub('settings')}
            className="py-3 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Target size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Hạn Mức Chi Tiêu Tháng</p>
                <p className="text-[11px] text-slate-400">
                  {data.settings.budget > 0 ? formatVNDShort(data.settings.budget) : 'Chưa thiết lập'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          {onOpenGitHubModal && (
            <div
              onClick={onOpenGitHubModal}
              className="py-3 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Rocket size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Cập Nhật Lên Vercel & GitHub</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold">Mới</span>
                  </p>
                  <p className="text-[11px] text-slate-400">Đẩy tính năng mới lên trang web Vercel</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
          )}

          <div
            onClick={() => onNavigateSub('settings')}
            className="py-3 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Download size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Sao Lưu & Khôi Phục Dữ Liệu</p>
                <p className="text-[11px] text-slate-400">Xuất file JSON an toàn về máy</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
