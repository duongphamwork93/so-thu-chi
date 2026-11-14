import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Clock,
  ChevronRight,
  Target,
  Wallet,
  CheckCircle2,
  Calendar,
  Layers,
  PieChart,
  Edit3,
  Mic,
  Plus,
  Users,
  Compass,
  HandCoins,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CATEGORY_MAP } from '../../constants/categories';
import { CategoryIcon } from '../CategoryIcon';
import { ReportMode, ReportsView } from './ReportsView';
import { Transaction } from '../../types/finance';
import { EditTransactionModal } from '../modals/EditTransactionModal';
import {
  calculateDepositAccrued,
  calculateNetWorthBreakdown,
  formatDateVietnamese,
  formatVND,
  formatVNDShort,
  getTodayDateString,
  shiftMonthString,
} from '../../utils/formatters';

interface OverviewViewProps {
  onNavigateTab: (tab: any) => void;
  onOpenAddModal: () => void;
  onOpenAddForDate?: (dateStr: string) => void;
  onOpenVoice?: () => void;
  onOpenTripsContacts?: (tab: 'trips' | 'contacts') => void;
  onOpenDebts?: () => void;
  initialSection?: 'overview' | 'report';
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateTab,
  onOpenAddModal,
  onOpenAddForDate,
  onOpenVoice,
  onOpenTripsContacts,
  onOpenDebts,
  initialSection = 'overview',
}) => {
  const { data, currentMonth, recordRecurringNow, categoryMap } = useFinance();
  const [viewSection, setViewSection] = useState<'overview' | 'report'>(initialSection);
  const [reportModeIntent, setReportModeIntent] = useState<ReportMode>('member');
  const [reportTypeIntent, setReportTypeIntent] = useState<'out' | 'in'>('out');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  useEffect(() => {
    setViewSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    setSelectedCalendarDate(null);
  }, [currentMonth]);

  // All transactions in currentMonth for ledger display
  const monthTransactions = useMemo(
    () => data.records.filter(r => r.date && r.date.startsWith(currentMonth)),
    [data.records, currentMonth]
  );

  // Transactions included in statistical reports
  const reportMonthTransactions = useMemo(
    () => monthTransactions.filter(r => !r.excludeFromReport),
    [monthTransactions]
  );

  const incomeList = reportMonthTransactions.filter(r => r.type === 'in');
  const expenseList = reportMonthTransactions.filter(r => r.type === 'out');

  const totalIncome = incomeList.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenseList.reduce((sum, r) => sum + r.amount, 0);
  const netSavings = totalIncome - totalExpense;

  // 5-Month Flow Comparison
  const fiveMonthStats = useMemo(() => {
    const months = [-4, -3, -2, -1, 0].map(offset => shiftMonthString(currentMonth, offset));
    const items = months.map(m => {
      const mRecords = data.records.filter(
        r => r.date && r.date.startsWith(m) && !r.excludeFromReport
      );
      const inc = mRecords.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
      const exp = mRecords.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
      const parts = m.split('-');
      return {
        monthKey: m,
        label: `T${parseInt(parts[1], 10)}`,
        inc,
        exp,
      };
    });
    const maxVal = Math.max(1, ...items.map(i => Math.max(i.inc, i.exp)));
    const prevExp = items[3]?.exp || 0;
    const curExp = items[4]?.exp || 0;
    const expChangePct =
      prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : null;
    return { items, maxVal, expChangePct };
  }, [data.records, currentMonth]);

  // Monthly Calendar Matrix (Monday - Sunday)
  const calendarGrid = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7; // 0 = T2, 6 = CN

    const byDate: Record<string, { inSum: number; outSum: number; txs: Transaction[] }> = {};
    monthTransactions.forEach(tx => {
      if (!byDate[tx.date]) {
        byDate[tx.date] = { inSum: 0, outSum: 0, txs: [] };
      }
      byDate[tx.date].txs.push(tx);
      if (!tx.excludeFromReport) {
        if (tx.type === 'in') byDate[tx.date].inSum += tx.amount;
        else byDate[tx.date].outSum += tx.amount;
      }
    });

    const cells: Array<{
      dateStr?: string;
      day?: number;
      inSum: number;
      outSum: number;
      txCount: number;
    }> = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ inSum: 0, outSum: 0, txCount: 0 });
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentMonth}-${pad(d)}`;
      const entry = byDate[dateStr];
      cells.push({
        dateStr,
        day: d,
        inSum: entry?.inSum || 0,
        outSum: entry?.outSum || 0,
        txCount: entry?.txs.length || 0,
      });
    }

    return { cells, byDate };
  }, [currentMonth, monthTransactions]);

  // Total balance & net worth breakdown
  const totalLiquidCash = data.accts.reduce((sum, a) => sum + a.balance, 0);
  const netWorthData = calculateNetWorthBreakdown(data);
  const totalAssetsPlus = netWorthData.totalGrossAssets + netWorthData.receivables;
  const totalDebtMinus = netWorthData.totalLiabilities;

  // Budget calculations
  const monthlyBudget = data.settings.budget || 0;
  const budgetPct = monthlyBudget > 0 ? Math.round((totalExpense / monthlyBudget) * 100) : 0;
  const budgetRemaining = monthlyBudget - totalExpense;

  const now = new Date();
  const [currentY, currentM] = currentMonth.split('-').map(Number);
  const isCurrentMonthActive = now.getFullYear() === currentY && now.getMonth() + 1 === currentM;
  const daysInMonth = new Date(currentY, currentM, 0).getDate();
  const currentDay = isCurrentMonthActive ? now.getDate() : daysInMonth;
  const daysRemainingInMonth = Math.max(0, daysInMonth - currentDay);
  const todayStr = getTodayDateString();

  // Smart due reminders
  const dueItems: Array<{
    id: string;
    type: 'card' | 'dep' | 'debt' | 'rec';
    title: string;
    subtitle: string;
    amount?: number;
    badge: string;
    isUrgent?: boolean;
    action?: () => void;
  }> = [];

  const todayDay = now.getDate();
  data.cards.forEach(card => {
    if (card.currentBalance > 0) {
      const daysUntilDue = card.dueDay >= todayDay ? card.dueDay - todayDay : 30 - todayDay + card.dueDay;
      if (daysUntilDue <= 7) {
        dueItems.push({
          id: card.id,
          type: 'card',
          title: `Thẻ ${card.name} đến hạn`,
          subtitle: `Hạn thanh toán ngày ${card.dueDay} hàng tháng`,
          amount: card.currentBalance,
          badge: daysUntilDue === 0 ? 'Hạn hôm nay' : `Còn ${daysUntilDue} ngày`,
          isUrgent: daysUntilDue <= 3,
        });
      }
    }
  });

  data.deps
    .filter(d => !d.closed)
    .forEach(dep => {
      const { daysLeft, accrued } = calculateDepositAccrued(dep);
      if (daysLeft <= 14) {
        dueItems.push({
          id: dep.id,
          type: 'dep',
          title: `Sổ tiết kiệm ${dep.bank} sắp đáo hạn`,
          subtitle: `Gốc ${formatVNDShort(dep.amount)} + Lãi dự tính ${formatVNDShort(accrued)}`,
          amount: dep.amount,
          badge: daysLeft === 0 ? 'Đáo hạn hôm nay' : `Còn ${daysLeft} ngày`,
          isUrgent: false,
        });
      }
    });

  data.debts
    .filter(d => !d.closed && d.dueDate)
    .forEach(debt => {
      const remaining = debt.amount - (debt.paidAmount || 0);
      dueItems.push({
        id: debt.id,
        type: 'debt',
        title: debt.dir === 'lend' ? `Thu nợ: ${debt.targetName}` : `Trả nợ: ${debt.targetName}`,
        subtitle: debt.name,
        amount: remaining,
        badge: `Hạn: ${debt.dueDate?.slice(8)}/${debt.dueDate?.slice(5, 7)}`,
        isUrgent: false,
      });
    });

  data.recs.forEach(rec => {
    const isDue = rec.dayOfMonth <= todayDay && rec.lastRecorded !== currentMonth;
    if (isDue) {
      dueItems.push({
        id: rec.id,
        type: 'rec',
        title: `Đến hạn: ${rec.name}`,
        subtitle: `Ngày ${rec.dayOfMonth} hàng tháng`,
        amount: rec.amount,
        badge: 'Ghi ngay',
        isUrgent: true,
        action: () => recordRecurringNow(rec.id),
      });
    }
  });

  const openSpecificReport = (mode: ReportMode, type: 'out' | 'in' = 'out') => {
    setReportModeIntent(mode);
    setReportTypeIntent(type);
    setViewSection('report');
  };

  const selectedDayData = selectedCalendarDate ? calendarGrid.byDate[selectedCalendarDate] : null;

  return (
    <div className="space-y-4 pb-6">
      {/* 0. Top Section Segmented Bar */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
        <button
          type="button"
          onClick={() => setViewSection('overview')}
          className={`min-h-[42px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            viewSection === 'overview'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers size={16} className={viewSection === 'overview' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
          <span>Tổng Quan Tài Chính</span>
        </button>

        <button
          type="button"
          onClick={() => setViewSection('report')}
          className={`min-h-[42px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            viewSection === 'report'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <PieChart size={16} className={viewSection === 'report' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
          <span>Báo Cáo Chi Tiêu & Con</span>
        </button>
      </div>

      {viewSection === 'report' ? (
        <ReportsView
          onOpenAddModal={onOpenAddModal}
          initialMode={reportModeIntent}
          initialType={reportTypeIntent}
        />
      ) : (
        <>
          {/* 1. CARD 1: TÀI CHÍNH HIỆN TẠI + TỔNG CÓ / TỔNG NỢ + VOICE SHORTCUT */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Wallet size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>Tài Chính Hiện Tại</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('assets')}
                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline normal-case flex items-center gap-0.5 text-xs cursor-pointer"
              >
                <span>Chi tiết ví</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div className="money-mask">
                <div className="text-3xl sm:text-4xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight tabular-nums">
                  {formatVND(totalLiquidCash)}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Số dư khả dụng trên {data.accts.length} tài khoản · Tài sản ròng:{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {formatVNDShort(netWorthData.netWorth)}
                  </strong>
                </p>
              </div>
            </div>

            {/* Tổng có & Tổng nợ */}
            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="p-2.5 rounded-2xl bg-green-50/70 dark:bg-green-950/30 border border-green-200/60 dark:border-green-800/40">
                <span className="text-[11px] font-semibold text-green-700 dark:text-green-300 block">
                  Tổng có (Tài sản + Cho vay)
                </span>
                <span className="money-mask font-extrabold text-sm text-green-700 dark:text-green-400 tabular-nums">
                  {formatVND(totalAssetsPlus)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/40">
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 block">
                  Tổng nợ (Thẻ & Vay nợ)
                </span>
                <span className="money-mask font-extrabold text-sm text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatVND(totalDebtMinus)}
                </span>
              </div>
            </div>

            {/* Quick Action Strip: Voice + Manual + Ledger */}
            <div className="flex flex-wrap gap-2 pt-1">
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={onOpenVoice}
                  className="flex-1 min-w-[140px] min-h-[44px] py-3 px-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Mic size={16} />
                  <span>Ghi bằng giọng nói</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenAddModal}
                className="flex-1 min-w-[125px] min-h-[44px] py-3 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>Ghi sổ nhanh</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('ledger')}
                className="min-h-[44px] py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                title="Mở lịch sử ghi chép"
              >
                <BookOpen size={16} />
                <span className="hidden sm:inline">Lịch sử</span>
              </button>
            </div>
          </div>

          {/* 2. CARD 2: TÌNH HÌNH THU CHI THÁNG NÀY + SO SÁNH 5 THÁNG */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Tình Hình Thu Chi Tháng Này
                </h3>
              </div>
              <button
                type="button"
                onClick={() => openSpecificReport('category', 'out')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Báo cáo</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* 5-Month Comparison + This Month Totals */}
            <div className="grid grid-cols-12 gap-4 items-center">
              {/* Compact 5-month grouped vertical bars */}
              <div className="col-span-12 sm:col-span-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    Xu hướng 5 tháng gần nhất
                  </span>
                  {fiveMonthStats.expChangePct !== null && (
                    <span
                      className={`font-bold ${
                        fiveMonthStats.expChangePct > 0 ? 'text-rose-500' : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      Chi {fiveMonthStats.expChangePct > 0 ? `+${fiveMonthStats.expChangePct}%` : `${fiveMonthStats.expChangePct}%`} vs T.trước
                    </span>
                  )}
                </div>

                <div className="h-28 flex items-end justify-between gap-2 pt-2">
                  {fiveMonthStats.items.map((item, idx) => {
                    const incH = item.inc > 0 ? Math.max(8, Math.round((item.inc / fiveMonthStats.maxVal) * 100)) : 4;
                    const expH = item.exp > 0 ? Math.max(8, Math.round((item.exp / fiveMonthStats.maxVal) * 100)) : 4;
                    const isCurrent = idx === 4;
                    return (
                      <div key={item.monthKey} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            className={`w-2.5 sm:w-3 rounded-t-md transition-all ${
                              isCurrent ? 'bg-green-500' : 'bg-green-400/70'
                            }`}
                            style={{ height: `${incH}%` }}
                            title={`${item.label} Thu: ${formatVND(item.inc)}`}
                          />
                          <div
                            className={`w-2.5 sm:w-3 rounded-t-md transition-all ${
                              isCurrent ? 'bg-rose-500' : 'bg-rose-400/70'
                            }`}
                            style={{ height: `${expH}%` }}
                            title={`${item.label} Chi: ${formatVND(item.exp)}`}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-bold ${
                            isCurrent ? 'text-slate-900 dark:text-white' : 'text-slate-400'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side Legend & Numbers */}
              <div className="col-span-12 sm:col-span-6 space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Tổng thu
                    </span>
                  </div>
                  <span className="money-mask text-xs sm:text-sm font-black text-green-600 dark:text-green-400 tabular-nums">
                    +{formatVND(totalIncome)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Tổng chi
                    </span>
                  </div>
                  <span className="money-mask text-xs sm:text-sm font-black text-rose-500 tabular-nums">
                    -{formatVND(totalExpense)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${netSavings >= 0 ? 'bg-cyan-500' : 'bg-amber-500'}`} />
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Chênh lệch (Tích lũy)
                    </span>
                  </div>
                  <span className={`money-mask text-xs sm:text-sm font-black tabular-nums ${netSavings >= 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-amber-500'}`}>
                    {formatVND(netSavings)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. LỊCH THU CHI THEO THÁNG (MISA MONTHLY CALENDAR HEATMAP) */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Lịch Thu Chi Tháng {currentM}/{currentY}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('ledger')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Lịch sử ghi chép</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(d => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Matrix */}
            <div className="grid grid-cols-7 gap-1">
              {calendarGrid.cells.map((cell, idx) => {
                if (!cell.dateStr || !cell.day) {
                  return <div key={`empty_${idx}`} className="h-14 sm:h-16 rounded-xl bg-slate-50/40 dark:bg-slate-800/20" />;
                }

                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedCalendarDate;

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() =>
                      setSelectedCalendarDate(prev => (prev === cell.dateStr ? null : cell.dateStr!))
                    }
                    className={`h-14 sm:h-16 p-1 rounded-xl border flex flex-col items-center justify-between transition-all cursor-pointer overflow-hidden ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/50 ring-1 ring-emerald-500/40'
                        : isToday
                        ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/30'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-bold leading-none ${
                        isSelected
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : isToday
                          ? 'text-cyan-700 dark:text-cyan-300'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cell.day}
                    </span>

                    <div className="w-full text-center space-y-0.5 leading-none">
                      {cell.inSum > 0 && (
                        <div className="money-mask text-[9px] sm:text-[10px] font-bold text-green-600 dark:text-green-400 truncate tabular-nums">
                          +{formatVNDShort(cell.inSum)}
                        </div>
                      )}
                      {cell.outSum > 0 && (
                        <div className="money-mask text-[9px] sm:text-[10px] font-bold text-rose-500 truncate tabular-nums">
                          -{formatVNDShort(cell.outSum)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Day Inspector Drawer */}
            {selectedCalendarDate && (
              <div className="mt-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-emerald-200/70 dark:border-emerald-800/50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                      Chi tiết ngày {formatDateVietnamese(selectedCalendarDate)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {selectedDayData?.txs.length || 0} giao dịch
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenAddForDate ? onOpenAddForDate(selectedCalendarDate) : onOpenAddModal()
                    }
                    className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Ghi ngày này</span>
                  </button>
                </div>

                {!selectedDayData || selectedDayData.txs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có giao dịch nào trong ngày này.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                    {selectedDayData.txs.map(tx => {
                      const cat = categoryMap[tx.cat] || CATEGORY_MAP[tx.cat];
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setEditingTx(tx)}
                          className="w-full text-left py-2 flex items-center justify-between gap-2 hover:bg-white/60 dark:hover:bg-slate-800 rounded-lg px-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon catKey={tx.cat} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {tx.note || cat?.name || 'Giao dịch'}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {cat?.name || 'Khác'}
                                {tx.counterparty ? ` · ${tx.counterparty}` : ''}
                                {tx.tripName ? ` · ${tx.tripName}` : ''}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`money-mask text-xs font-extrabold tabular-nums shrink-0 ${
                              tx.type === 'in'
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-rose-500'
                            }`}
                          >
                            {tx.type === 'in' ? '+' : '-'}
                            {formatVND(tx.amount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. 6-TILE ANALYTICS & UTILITIES HUB (MISA REPORT SHORTCUTS IN SYSTEM THEME) */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider px-1 block">
              Phân Tích & Tiện Ích Sổ Thu Chi
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                {
                  title: 'Phân tích chi tiêu',
                  sub: 'Tỷ trọng danh mục chi',
                  icon: PieChart,
                  color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50',
                  onClick: () => openSpecificReport('category', 'out'),
                },
                {
                  title: 'Phân tích thu',
                  sub: 'Nguồn thu theo tháng',
                  icon: TrendingUp,
                  color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
                  onClick: () => openSpecificReport('category', 'in'),
                },
                {
                  title: 'Theo dõi vay nợ',
                  sub: 'Cho vay & Cần trả',
                  icon: HandCoins,
                  color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
                  onClick: () => (onOpenDebts ? onOpenDebts() : onNavigateTab('assets')),
                },
                {
                  title: 'Đối tượng thu/chi',
                  sub: 'Thống kê với ai',
                  icon: Users,
                  color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50',
                  onClick: () => onOpenTripsContacts && onOpenTripsContacts('contacts'),
                },
                {
                  title: 'Chuyến đi / Sự kiện',
                  sub: 'Đang theo dõi & kết thúc',
                  icon: Compass,
                  color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50',
                  onClick: () => onOpenTripsContacts && onOpenTripsContacts('trips'),
                },
                {
                  title: 'Phân tích 6 Hũ',
                  sub: 'NEC · FFA · EDUC · PLAY...',
                  icon: Layers,
                  color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
                  onClick: () => openSpecificReport('sixjars', 'out'),
                },
              ].map(tile => {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.title}
                    type="button"
                    onClick={tile.onClick}
                    className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-400/70 hover:shadow-sm transition-all text-left flex items-start gap-2.5 active:scale-[0.98] cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tile.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate">
                        {tile.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-tight truncate">
                        {tile.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. CARD 3: HẠN MỨC CHI */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Hạn Mức Chi
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Calendar size={13} />
                <span>Còn {daysRemainingInMonth} ngày</span>
              </span>
            </div>

            {monthlyBudget > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    Đã chi: <span className="money-mask font-bold text-slate-900 dark:text-white">{formatVND(totalExpense)}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Hạn mức: {formatVNDShort(monthlyBudget)} ({budgetPct}%)
                  </span>
                </div>

                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetPct >= 100
                        ? 'bg-rose-500'
                        : budgetPct >= 85
                        ? 'bg-amber-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {budgetRemaining >= 0 ? (
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        Còn lại: {formatVND(budgetRemaining)}
                      </span>
                    ) : (
                      <span className="text-rose-500 font-bold">
                        Đã vượt: {formatVND(Math.abs(budgetRemaining))}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('settings')}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    Cài đặt hạn mức
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500">
                  Bạn chưa cài hạn mức chi tiêu tháng này để kiểm soát dòng tiền.
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('settings')}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 active:scale-95 transition-all cursor-pointer"
                >
                  Đặt hạn mức
                </button>
              </div>
            )}
          </div>

          {/* 6. Smart Reminders */}
          {dueItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider px-1">
                <Clock size={14} className="text-amber-500" />
                <span>Việc Cần Lưu Ý & Đến Hạn ({dueItems.length})</span>
              </div>

              <div className="space-y-2">
                {dueItems.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.isUrgent
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.amount !== undefined && (
                        <span className="money-mask text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatVND(item.amount)}
                        </span>
                      )}
                      {item.action && (
                        <button
                          type="button"
                          onClick={item.action}
                          className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                        >
                          Ghi ngay
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. GHI CHÉP GẦN ĐÂY */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Ghi Chép Gần Đây
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('ledger')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Mở sổ thu chi ({data.records.length})</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {monthTransactions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Chưa có ghi chép nào trong tháng này
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chạm nút (+) hoặc nút Ghi bằng giọng nói để thêm giao dịch ngay
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="min-h-[44px] px-5 py-2.5 bg-emerald-600 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-sm shadow-emerald-500/20 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                >
                  + Ghi giao dịch ngay
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl divide-y divide-slate-100 dark:divide-slate-800/80 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                {monthTransactions.slice(0, 5).map(tx => {
                  const cat = categoryMap[tx.cat] || CATEGORY_MAP[tx.cat] || { name: 'Khác' };
                  const isExpense = tx.type === 'out';
                  const account = data.accts.find(a => a.id === tx.accountId);
                  const card = !account ? data.cards.find(c => c.id === tx.accountId) : undefined;
                  const payLabel = account ? account.name : card ? card.name : '';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setEditingTx(tx)}
                      className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon catKey={tx.cat} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {tx.note || cat.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 flex-wrap">
                            <span>{formatDateVietnamese(tx.date)}</span>
                            {payLabel && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[120px] font-medium text-slate-500 dark:text-slate-400">
                                  {payLabel}
                                </span>
                              </>
                            )}
                            {tx.tripName && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[100px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  {tx.tripName}
                                </span>
                              </>
                            )}
                            {tx.excludeFromReport && (
                              <>
                                <span>·</span>
                                <span className="text-[11px] italic text-slate-400">Không tính BC</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span
                            className={`money-mask font-bold text-sm sm:text-base tabular-nums ${
                              isExpense ? 'text-rose-500' : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            {isExpense ? '-' : '+'}
                            {formatVND(tx.amount)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setEditingTx(tx);
                          }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800/80 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          title="Sửa giao dịch"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <EditTransactionModal
        isOpen={editingTx !== null}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
      />
    </div>
  );
};
