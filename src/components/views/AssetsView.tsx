import React, { useEffect, useState } from 'react';
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  CreditCard as CardIcon,
  HandCoins,
  Target,
  Plus,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
  CheckCircle,
  Coins,
  ShieldCheck,
  ChevronRight,
  Percent,
  RefreshCw,
  Sparkles,
  Edit3,
  Trash2,
  Star,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../../context/FinanceContext';
import {
  calculateDepositAccrued,
  calculateHoldingValue,
  calculateNetWorthBreakdown,
  formatVND,
  formatVNDShort,
} from '../../utils/formatters';
import { AssetCategoryType } from '../modals/AddAssetModal';
import { EditAssetModal, EditableAssetType } from '../modals/EditAssetModal';
import { DepositActionModal } from '../modals/DepositActionModal';
import { AccountDetailTarget, AccountDetailView } from '../modals/AccountDetailView';
import { SavingsDeposit } from '../../types/finance';

interface AssetsViewProps {
  onOpenAddAsset: (type: AssetCategoryType) => void;
  onOpenTransfer: () => void;
  initialSubTab?: AssetCategoryType;
}

export const getHoldingTypeBadge = (type: string) => {
  switch (type) {
    case 'stock':
      return { label: 'Cổ phiếu', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
    case 'gold':
      return { label: 'Vàng', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' };
    case 'silver':
      return { label: 'Bạc', color: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold' };
    case 'fund':
      return { label: 'Chứng chỉ quỹ', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
    case 'crypto':
      return { label: 'Crypto', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' };
    default:
      return { label: 'Tài sản', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  }
};

export const AssetsView: React.FC<AssetsViewProps> = ({
  onOpenAddAsset,
  onOpenTransfer,
  initialSubTab,
}) => {
  const {
    data,
    deleteAccount,
    closeDeposit,
    deleteDeposit,
    addHolding,
    deleteHolding,
    updateHoldingsPrices,
    payCreditCard,
    recordDebtPayment,
    deleteDebt,
    contributeGoal,
    deleteGoal,
    deleteCreditCard,
    updateSettings,
  } = useFinance();

  const [activeSubTab, setActiveSubTab] = useState<AssetCategoryType>(initialSubTab || 'account');

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [editingAssetType, setEditingAssetType] = useState<EditableAssetType | null>(null);
  const [editingAssetData, setEditingAssetData] = useState<any | null>(null);

  const [actionDeposit, setActionDeposit] = useState<SavingsDeposit | null>(null);
  const [actionDepositMode, setActionDepositMode] = useState<'withdraw' | 'settle'>('withdraw');
  const [detailTarget, setDetailTarget] = useState<AccountDetailTarget | null>(null);

  const handleEditAsset = (type: EditableAssetType, asset: any) => {
    setEditingAssetType(type);
    setEditingAssetData(asset);
  };

  const [isUpdatingMarket, setIsUpdatingMarket] = useState<boolean>(false);
  const [marketStatusMsg, setMarketStatusMsg] = useState<string | null>(null);
  const [lastMarketTime, setLastMarketTime] = useState<string | null>(null);

  // Breakdown calculations
  const breakdown = calculateNetWorthBreakdown(data);

  // Helper trigger celebration
  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  // Update market prices handler
  const handleUpdateMarketPrices = async () => {
    if (data.holds.length === 0) {
      alert('Danh mục hiện chưa có mã đầu tư nào. Hãy bấm "+ Thêm mã" để thêm Cổ phiếu, Vàng hoặc Bạc trước!');
      return;
    }

    setIsUpdatingMarket(true);
    setMarketStatusMsg(null);

    try {
      const res = await fetch('/api/gemini/update-market-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holdings: data.holds }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể cập nhật giá thị trường');
      }

      const updated = json.updatedHoldings || [];
      if (updated.length > 0) {
        updateHoldingsPrices(
          updated.map((item: any) => ({
            id: item.id,
            currentPrice: item.newPrice,
          }))
        );
        const timeStr = json.updatedAt || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        setLastMarketTime(timeStr);
        setMarketStatusMsg(`Đã cập nhật giá mới nhất cho ${updated.length} tài sản (Cổ phiếu, Vàng, Bạc)!`);
        triggerCelebration();
        setTimeout(() => setMarketStatusMsg(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật giá thị trường');
    } finally {
      setIsUpdatingMarket(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Net Worth Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-950/70 dark:via-teal-950/50 dark:to-slate-900 text-slate-900 dark:text-white p-6 shadow-sm border border-emerald-200/90 dark:border-emerald-800/50">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
              Tổng Tài Sản Ròng (Net Worth)
            </span>
            <div className="flex items-center gap-1.5">
              {lastMarketTime && (
                <span className="hidden sm:inline-block text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  Giá lúc {lastMarketTime}
                </span>
              )}
              <div className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/80 dark:bg-white/10 backdrop-blur-md border border-emerald-200/80 dark:border-white/15 text-emerald-700 dark:text-emerald-300">
                Trực tiếp
              </div>
            </div>
          </div>

          <div className="money-mask">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {formatVND(breakdown.netWorth)}
            </h2>
          </div>

          {/* Sub summary: Assets vs Liabilities */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/70 dark:border-white/10 text-xs">
            <div>
              <span className="text-slate-600 dark:text-green-200/90 block font-medium">Tổng tài sản (+):</span>
              <span className="money-mask font-bold text-sm text-green-600 dark:text-green-300">
                {formatVND(breakdown.totalGrossAssets + breakdown.receivables)}
              </span>
            </div>
            <div>
              <span className="text-slate-600 dark:text-rose-200/80 block font-medium">Tổng nợ & Thẻ (-):</span>
              <span className="money-mask font-bold text-sm text-rose-600 dark:text-rose-300">
                {formatVND(breakdown.totalLiabilities)}
              </span>
            </div>
          </div>

          {/* Quick Actions in Hero Banner */}
          <div className="flex items-center justify-between pt-2 border-t border-emerald-200/70 dark:border-white/10">
            <button
              type="button"
              onClick={handleUpdateMarketPrices}
              disabled={isUpdatingMarket || data.holds.length === 0}
              className="min-h-[38px] px-4 py-2 rounded-xl bg-white/85 hover:bg-white dark:bg-white/15 dark:hover:bg-white/25 backdrop-blur-md border border-emerald-200/90 dark:border-white/20 text-emerald-700 dark:text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
              title="Tự động cập nhật giá cổ phiếu, vàng, bạc theo giá thị trường"
            >
              <RefreshCw size={14} className={isUpdatingMarket ? 'animate-spin' : ''} />
              <span>{isUpdatingMarket ? 'Đang cập nhật...' : 'Cập Nhật Giá Thị Trường'}</span>
            </button>
          </div>
        </div>
      </div>

      {marketStatusMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Sparkles size={16} className="text-emerald-600 shrink-0" />
          <span>{marketStatusMsg}</span>
        </div>
      )}

      {/* 2. Sub Category Navigation Tabs */}
      <div className="flex gap-1.5 overflow-x-auto p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl no-scrollbar">
        {[
          { key: 'account' as AssetCategoryType, label: 'Ví & Ngân hàng', count: data.accts.length, icon: Wallet },
          { key: 'deposit' as AssetCategoryType, label: 'Sổ tiết kiệm', count: data.deps.filter(d => !d.closed).length, icon: PiggyBank },
          { key: 'holding' as AssetCategoryType, label: 'Đầu tư & Vàng', count: data.holds.length, icon: TrendingUp },
          { key: 'card' as AssetCategoryType, label: 'Thẻ tín dụng', count: data.cards.length, icon: CardIcon },
          { key: 'debt' as AssetCategoryType, label: 'Vay & Nợ', count: data.debts.filter(d => !d.closed).length, icon: HandCoins },
          { key: 'goal' as AssetCategoryType, label: 'Mục tiêu', count: data.goals.length, icon: Target },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`min-h-[42px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-emerald-600 dark:text-emerald-400' : ''} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Sub Tab Content */}

      {/* A. ACCOUNTS & WALLETS */}
      {activeSubTab === 'account' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tài khoản thanh toán ({formatVND(breakdown.accountsTotal)})
            </span>
            <div className="flex gap-2">
              <button
                onClick={onOpenTransfer}
                className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 flex items-center gap-1.5 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowRightLeft size={14} />
                <span>Chuyển tiền</span>
              </button>
              <button
                onClick={() => onOpenAddAsset('account')}
                className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Thêm ví</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.accts.map(acc => {
              const txCount = data.records.filter(r => r.accountId === acc.id).length;
              return (
                <div
                  key={acc.id}
                  onClick={() => setDetailTarget({ kind: 'account', id: acc.id })}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md active:scale-[0.99] transition-all"
                  title="Chạm để xem chi tiết các giao dịch của tài khoản này"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: acc.color || '#10B981' }}
                    >
                      <Wallet size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {acc.name}
                        </p>
                        {data.settings.defaultPaymentAccountId === acc.id ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-0.5 border border-indigo-200/70 dark:border-indigo-800/60">
                            <Star size={9} className="fill-current" />
                            <span>Ví chính</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              updateSettings({ defaultPaymentAccountId: acc.id });
                            }}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                            title="Đặt làm ví thanh toán chính mặc định"
                          >
                            Đặt chính
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {acc.type === 'bank' ? 'Tài khoản ngân hàng' : acc.type === 'wallet' ? 'Ví điện tử' : 'Tiền mặt'}
                        {' · '}
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {txCount} giao dịch ›
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="text-right">
                      <p className="money-mask font-bold text-base text-slate-900 dark:text-white">
                        {formatVND(acc.balance)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleEditAsset('account', acc);
                      }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800/80 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95 transition-all cursor-pointer"
                      title="Sửa tài khoản / số dư"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${acc.name}" không?`)) {
                          deleteAccount(acc.id);
                        }
                      }}
                      className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50/70 dark:bg-rose-950/30 text-rose-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer"
                      title="Xóa tài khoản này"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* B. SAVINGS DEPOSITS */}
      {activeSubTab === 'deposit' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sổ tiết kiệm ({formatVND(breakdown.depositsTotal)})
            </span>
            <button
              onClick={() => onOpenAddAsset('deposit')}
              className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Gửi sổ mới</span>
            </button>
          </div>

          {data.deps.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400">Chưa có sổ tiết kiệm nào được tạo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.deps.map(dep => {
                const { accrued, maturityInterest, daysLeft } = calculateDepositAccrued(dep);
                return (
                  <div
                    key={dep.id}
                    className={`bg-white dark:bg-slate-900 p-4 rounded-3xl border shadow-sm space-y-3 ${
                      dep.closed
                        ? 'opacity-60 border-slate-200 dark:border-slate-800'
                        : 'border-slate-200/80 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold">
                          <PiggyBank size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {dep.bank} ({dep.termMonths} tháng)
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-400">
                              Lãi suất: <strong className="text-emerald-600">{dep.interestRate}%/năm</strong>
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {dep.rollover === 'all'
                                ? '🔄 Quay vòng gốc & lãi'
                                : dep.rollover === 'principal'
                                ? '🔁 Quay vòng gốc (rút lãi)'
                                : '⏹️ Tất toán khi đáo hạn'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="money-mask font-bold text-base text-slate-900 dark:text-white">
                          {formatVND(dep.amount)}
                        </span>
                        <div className="text-[11px] text-emerald-600 font-medium">
                          + Lãi: {formatVND(accrued)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        <span>Đáo hạn: {dep.maturityDate}</span>
                        {!dep.closed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 font-bold ml-1">
                            Còn {daysLeft} ngày
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!dep.closed && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setActionDeposit(dep);
                                setActionDepositMode('withdraw');
                              }}
                              className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer"
                              title="Rút một phần gốc linh hoạt"
                            >
                              Rút một phần
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActionDeposit(dep);
                                setActionDepositMode('settle');
                              }}
                              className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 active:scale-95 transition-all cursor-pointer"
                              title="Tất toán toàn bộ sổ tiết kiệm"
                            >
                              Tất toán
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditAsset('deposit', dep)}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                          title="Sửa thông tin sổ tiết kiệm"
                        >
                          <Edit3 size={14} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Bạn có chắc chắn muốn xóa thông tin sổ tiết kiệm này không?')) {
                              deleteDeposit(dep.id);
                            }
                          }}
                          className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* C. INVESTMENTS & HOLDINGS */}
      {activeSubTab === 'holding' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Danh mục đầu tư & Vàng, Bạc ({formatVND(breakdown.investmentsTotal)})
              </span>
              {lastMarketTime && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ Giá thị trường cập nhật lúc {lastMarketTime}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUpdateMarketPrices}
                disabled={isUpdatingMarket || data.holds.length === 0}
                className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                title="Tự động cập nhật giá cổ phiếu, vàng, bạc theo thị trường mới nhất"
              >
                <RefreshCw size={14} className={isUpdatingMarket ? 'animate-spin' : ''} />
                <span>{isUpdatingMarket ? 'Đang cập nhật giá...' : 'Cập Nhật Giá Thị Trường'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAddAsset('holding')}
                className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Thêm mã</span>
              </button>
            </div>
          </div>

          {data.holds.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400">Chưa có mã đầu tư nào trong danh mục.</p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 block w-full">Thêm nhanh để theo dõi giá thị trường:</span>
                <button
                  type="button"
                  onClick={() => {
                    addHolding({ code: 'FPT', name: 'Cổ phiếu FPT Corp', type: 'stock', quantity: 100, buyPrice: 120000, currentPrice: 138500 });
                    triggerCelebration();
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 hover:bg-blue-100 active:scale-95 transition-all cursor-pointer"
                >
                  + Cổ phiếu FPT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addHolding({ code: 'SJC', name: 'Vàng miếng SJC 999.9 (chỉ)', type: 'gold', quantity: 5, buyPrice: 7800000, currentPrice: 8850000 });
                    triggerCelebration();
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer"
                >
                  + Vàng SJC
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addHolding({ code: 'BAC', name: 'Bạc 999 Phú Quý (lượng)', type: 'silver', quantity: 10, buyPrice: 950000, currentPrice: 1080000 });
                    triggerCelebration();
                  }}
                  className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer"
                >
                  + Bạc 999 Phú Quý
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.holds.map(h => {
                const { value, pnl, pnlPercent } = calculateHoldingValue(h);
                const isProfitable = pnl >= 0;
                const typeInfo = getHoldingTypeBadge(h.type);
                return (
                  <div
                    key={h.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-base text-slate-900 dark:text-white uppercase">
                            {h.code}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[150px]">{h.name}</p>
                      </div>

                      <div className="text-right">
                        <p className="money-mask font-bold text-base text-slate-900 dark:text-white">
                          {formatVND(value)}
                        </p>
                        <p
                          className={`text-xs font-bold ${
                            isProfitable ? 'text-green-600 dark:text-green-400' : 'text-rose-500'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          {formatVND(pnl)} ({pnlPercent.toFixed(1)}%)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-400">
                      <span>SL: {h.quantity} | Giá TT: <strong className="text-slate-800 dark:text-slate-200">{formatVND(h.currentPrice)}</strong></span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditAsset('holding', h)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 cursor-pointer flex items-center gap-1.5 font-bold active:scale-95 transition-all"
                        >
                          <Edit3 size={14} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc chắn muốn xóa mã ${h.code}?`)) deleteHolding(h.id);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 cursor-pointer flex items-center gap-1.5 font-bold active:scale-95 transition-all"
                        >
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* D. CREDIT CARDS */}
      {activeSubTab === 'card' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Thẻ tín dụng (Tổng dư nợ: {formatVND(breakdown.creditCardsDebt)})
            </span>
            <button
              onClick={() => onOpenAddAsset('card')}
              className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm thẻ</span>
            </button>
          </div>

          {data.cards.map(card => {
            const usagePct = card.limit > 0 ? Math.round((card.currentBalance / card.limit) * 100) : 0;
            const txCount = data.records.filter(r => r.accountId === card.id).length;
            return (
              <div
                key={card.id}
                onClick={() => setDetailTarget({ kind: 'card', id: card.id })}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md active:scale-[0.99] transition-all"
                title="Chạm để xem chi tiết các giao dịch của thẻ này"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-950 text-white flex items-center justify-center font-bold shadow-sm">
                      <CardIcon size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{card.name}</h4>
                        {data.settings.defaultPaymentAccountId === card.id ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center gap-0.5 border border-indigo-200/70 dark:border-indigo-800/60">
                            <Star size={9} className="fill-current" />
                            <span>Thẻ chính</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              updateSettings({ defaultPaymentAccountId: card.id });
                            }}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            title="Đặt làm thẻ thanh toán chính mặc định"
                          >
                            Đặt thẻ chính
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        Sao kê ngày {card.statementDay} • Hạn trả ngày {card.dueDay}
                        {' · '}
                        <span className="text-sky-600 dark:text-sky-400 font-semibold">
                          {txCount} giao dịch ›
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Dư nợ hiện tại:</span>
                    <span className="money-mask font-bold text-base text-rose-500">
                      {formatVND(card.currentBalance)}
                    </span>
                  </div>
                </div>

                {/* Limit usage */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Hạn mức: {formatVND(card.limit)}</span>
                    <span className="font-bold">{usagePct}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usagePct >= 80 ? 'bg-rose-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(100, usagePct)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleEditAsset('card', card);
                      }}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      title="Sửa thẻ tín dụng"
                    >
                      <Edit3 size={14} />
                      <span>Sửa thẻ</span>
                    </button>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc chắn muốn xóa thẻ tín dụng "${card.name}" không?`)) {
                          deleteCreditCard(card.id);
                        }
                      }}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      title="Xóa thẻ"
                    >
                      <Trash2 size={14} />
                      <span>Xóa</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      const amountPrompt = prompt(
                        `Nhập số tiền muốn thanh toán cho thẻ ${card.name}:`,
                        String(card.currentBalance)
                      );
                      if (amountPrompt) {
                        const amt = parseFloat(amountPrompt);
                        if (amt > 0 && data.accts[0]) {
                          payCreditCard(card.id, data.accts[0].id, amt);
                          triggerCelebration();
                        }
                      }
                    }}
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    Thanh toán thẻ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* E. DEBTS (VAY & CHO VAY) */}
      {activeSubTab === 'debt' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sổ nợ (Phải thu: {formatVNDShort(breakdown.receivables)} • Phải trả: {formatVNDShort(breakdown.payables)})
            </span>
            <button
              onClick={() => onOpenAddAsset('debt')}
              className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Thêm khoản</span>
            </button>
          </div>

          {data.debts.length === 0 ? (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400">Không có khoản nợ hay cho vay nào.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.debts.map(debt => {
                const remaining = debt.amount - (debt.paidAmount || 0);
                const progressPct = debt.amount > 0 ? Math.round(((debt.paidAmount || 0) / debt.amount) * 100) : 0;
                const isLend = debt.dir === 'lend';
                return (
                  <div
                    key={debt.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isLend
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                            }`}
                          >
                            {isLend ? 'Cho vay (+)' : 'Đi vay (-)'}
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {debt.targetName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{debt.name}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Còn lại:</span>
                        <span className="money-mask font-bold text-base text-slate-900 dark:text-white">
                          {formatVND(remaining)}
                        </span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Đã trả: {formatVND(debt.paidAmount || 0)} / {formatVND(debt.amount)}</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isLend ? 'bg-green-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-slate-400">
                        {debt.dueDate ? `Hạn trả: ${debt.dueDate}` : 'Không có hạn'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {remaining > 0 && (
                          <button
                            onClick={() => {
                              const promptVal = prompt(
                                `Nhập số tiền ${isLend ? 'thu hồi' : 'trả bớt'}:`,
                                String(remaining)
                              );
                              if (promptVal) {
                                const val = parseFloat(promptVal);
                                if (val > 0) {
                                  recordDebtPayment(debt.id, val, data.accts[0]?.id);
                                  if (val >= remaining) triggerCelebration();
                                }
                              }
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer"
                          >
                            {isLend ? 'Ghi thu hồi' : 'Ghi trả nợ'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditAsset('debt', debt)}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Edit3 size={14} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn xóa khoản nợ "${debt.name}" không?`)) deleteDebt(debt.id);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 size={14} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* F. SAVINGS GOALS */}
      {activeSubTab === 'goal' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mục tiêu tiết kiệm ({data.goals.length})
            </span>
            <button
              onClick={() => onOpenAddAsset('goal')}
              className="min-h-[38px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Mục tiêu mới</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.goals.map(goal => {
              const pct = goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0;
              const isDone = pct >= 100;
              return (
                <div
                  key={goal.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                        <Target size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{goal.title}</h4>
                        <p className="text-xs text-slate-400">
                          {goal.targetDate ? `Dự kiến: ${goal.targetDate}` : 'Không thời hạn'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span className="money-mask font-semibold text-slate-900 dark:text-white">
                        {formatVND(goal.currentAmount)}
                      </span>
                      <span>/ {formatVNDShort(goal.targetAmount)}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditAsset('goal', goal)}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 size={14} />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa mục tiêu "${goal.title}" không?`)) deleteGoal(goal.id);
                        }}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Trash2 size={14} />
                        <span>Xóa</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const amtStr = prompt(`Góp thêm tiền vào "${goal.title}":`, '500000');
                        if (amtStr) {
                          const val = parseFloat(amtStr);
                          if (val > 0) {
                            contributeGoal(goal.id, val, data.accts[0]?.id);
                            if (goal.currentAmount + val >= goal.targetAmount) {
                              triggerCelebration();
                            }
                          }
                        }
                      }}
                      className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold active:scale-95 transition-all cursor-pointer"
                    >
                      + Góp tiền
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      <EditAssetModal
        isOpen={editingAssetType !== null}
        onClose={() => {
          setEditingAssetType(null);
          setEditingAssetData(null);
        }}
        assetType={editingAssetType}
        assetData={editingAssetData}
      />

      {/* Deposit Action Modal (Rút một phần & Tất toán) */}
      <DepositActionModal
        isOpen={actionDeposit !== null}
        onClose={() => setActionDeposit(null)}
        deposit={actionDeposit}
        mode={actionDepositMode}
      />

      {/* Dedicated Account / Credit Card Transaction History View */}
      <AccountDetailView
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
};
