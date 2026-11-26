import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  Search,
  X,
  Plus,
  ChevronDown,
  Wallet,
  CreditCard as CardIcon,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { Transaction } from '../../types/finance';
import { EditTransactionModal } from './EditTransactionModal';
import { AddTransactionModal } from './AddTransactionModal';

export interface AccountDetailTarget {
  kind: 'account' | 'card';
  id: string;
}

interface AccountDetailViewProps {
  target: AccountDetailTarget | null;
  onClose: () => void;
}

type DateRangeKey = '30days' | 'thisMonth' | 'lastMonth' | 'all';

const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  '30days': '30 ngày gần nhất',
  thisMonth: 'Tháng này',
  lastMonth: 'Tháng trước',
  all: 'Tất cả thời gian',
};

export const AccountDetailView: React.FC<AccountDetailViewProps> = ({ target, onClose }) => {
  const { data, categoryMap } = useFinance();

  const [dateRange, setDateRange] = useState<DateRangeKey>('30days');
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const account = useMemo(
    () => (target?.kind === 'account' ? data.accts.find(a => a.id === target.id) : undefined),
    [target, data.accts]
  );

  const card = useMemo(
    () => (target?.kind === 'card' ? data.cards.find(c => c.id === target.id) : undefined),
    [target, data.cards]
  );

  const isCard = target?.kind === 'card';
  const title = isCard ? card?.name || 'Thẻ tín dụng' : account?.name || 'Tài khoản';
  const currentBalance = isCard ? card?.currentBalance || 0 : account?.balance || 0;

  const beneficiariesMap = useMemo(
    () =>
      Object.fromEntries(
        getBeneficiaries(data.settings.memberNames, data.settings.customMembers).map(b => [
          b.key,
          b,
        ])
      ),
    [data.settings.memberNames, data.settings.customMembers]
  );

  // All transactions belonging strictly to this card/account
  const accountTransactions = useMemo(() => {
    if (!target) return [];
    return data.records
      .filter(r => r.accountId === target.id)
      .sort((a, b) => {
        const dCmp = (b.date || '').localeCompare(a.date || '');
        if (dCmp !== 0) return dCmp;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [data.records, target]);

  // Compute historical running balance/debt immediately AFTER each transaction
  // by walking chronologically backwards from today's live balance/debt.
  const afterBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!target) return map;

    type TimelineEvent =
      | { kind: 'tx'; id: string; date: string; createdAt: number; deltaEffect: number }
      | { kind: 'xfer'; date: string; createdAt: number; deltaEffect: number };

    const events: TimelineEvent[] = accountTransactions.map(tx => ({
      kind: 'tx',
      id: tx.id,
      date: tx.date || '',
      createdAt: tx.createdAt || 0,
      // deltaEffect is how this event changed `currentBalance` when moving forward in time
      deltaEffect: isCard
        ? tx.type === 'out'
          ? tx.amount
          : -tx.amount
        : tx.type === 'in'
        ? tx.amount
        : -tx.amount,
    }));

    if (!isCard) {
      (data.xfers || []).forEach(x => {
        if (x.fromId === target.id) {
          events.push({
            kind: 'xfer',
            date: x.date || '',
            createdAt: 0,
            deltaEffect: -(Number(x.amount) || 0),
          });
        } else if (x.toId === target.id) {
          events.push({
            kind: 'xfer',
            date: x.date || '',
            createdAt: 0,
            deltaEffect: Number(x.amount) || 0,
          });
        }
      });
    }

    events.sort((a, b) => {
      const dCmp = b.date.localeCompare(a.date);
      if (dCmp !== 0) return dCmp;
      return b.createdAt - a.createdAt;
    });

    let running = currentBalance;
    for (const ev of events) {
      if (ev.kind === 'tx') {
        map.set(ev.id, running);
      }
      running -= ev.deltaEffect;
    }

    return map;
  }, [accountTransactions, data.xfers, target, isCard, currentBalance]);

  // Apply date range and search filters
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;

    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const thirtyDaysCutoff = `${thirtyDaysAgo.getFullYear()}-${pad(
      thirtyDaysAgo.getMonth() + 1
    )}-${pad(thirtyDaysAgo.getDate())}`;

    return accountTransactions.filter(tx => {
      if (dateRange === '30days') {
        if (!tx.date || tx.date < thirtyDaysCutoff) return false;
      } else if (dateRange === 'thisMonth') {
        if (!tx.date || !tx.date.startsWith(thisMonthPrefix)) return false;
      } else if (dateRange === 'lastMonth') {
        if (!tx.date || !tx.date.startsWith(lastMonthPrefix)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const catName = (categoryMap[tx.cat]?.name || '').toLowerCase();
        const note = (tx.note || '').toLowerCase();
        const amt = String(tx.amount);
        const ben = tx.beneficiary ? (beneficiariesMap[tx.beneficiary]?.name || '').toLowerCase() : '';
        const trip = (tx.tripName || '').toLowerCase();
        const contact = (tx.counterparty || '').toLowerCase();
        const loc = (tx.location || '').toLowerCase();
        if (!catName.includes(q) && !note.includes(q) && !amt.includes(q) && !ben.includes(q) && !trip.includes(q) && !contact.includes(q) && !loc.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [accountTransactions, dateRange, searchQuery, categoryMap, beneficiariesMap]);

  const totalIn = useMemo(
    () => filteredTransactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0),
    [filteredTransactions]
  );

  const totalOut = useMemo(
    () => filteredTransactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0),
    [filteredTransactions]
  );

  // Group filtered transactions by day descending
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    filteredTransactions.forEach(tx => {
      const d = tx.date || 'Khác';
      if (!groups[d]) groups[d] = [];
      groups[d].push(tx);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredTransactions]);

  const getDayDetails = (dateStr: string) => {
    const parts = (dateStr || '').split('-');
    if (parts.length !== 3) {
      return { dayNum: '--', dayLabel: 'Khác', monthYear: '' };
    }
    const dayNum = parts[2];
    const monthYear = `${parts[1]}/${parts[0]}`;
    const today = getTodayDateString();
    let dayLabel = '';
    if (dateStr === today) {
      dayLabel = 'Hôm nay';
    } else {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
      dayLabel = days[d.getDay()] || '';
    }
    return { dayNum, dayLabel, monthYear };
  };

  if (!target || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-150">
      {/* 1. Header Bar aligned with system Emerald-Teal-Cyan theme */}
      <header className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-800 dark:via-teal-800 dark:to-cyan-900 text-white shadow-md shrink-0 pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            title="Quay lại"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
            {isCard ? (
              <CardIcon size={18} className="shrink-0 text-emerald-100" />
            ) : (
              <Wallet size={18} className="shrink-0 text-emerald-100" />
            )}
            <h1 className="font-bold text-base sm:text-lg truncate">{title}</h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowSearch(prev => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all cursor-pointer"
            title="Tìm kiếm giao dịch trong ví/thẻ này"
          >
            {showSearch ? <X size={20} /> : <Search size={20} />}
          </button>
        </div>

        {/* Collapsible Search Bar */}
        {showSearch && (
          <div className="max-w-3xl mx-auto px-4 pb-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={`Tìm giao dịch trong ${title}...`}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs sm:text-sm font-medium focus:outline-none shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto pb-28 sm:px-4">
        <div className="max-w-3xl mx-auto sm:pt-3 space-y-3">
          {/* 2. Date Filter Bar & Dual Totals Card */}
          <div className="bg-white dark:bg-slate-900 border-b sm:border border-slate-200/80 dark:border-slate-800 sm:rounded-3xl shadow-sm overflow-hidden">
            {/* Period Picker */}
            <div className="relative flex justify-center py-2.5 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-cyan-50/60 dark:from-slate-800/80 dark:to-slate-800/40 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRangeMenu(prev => !prev)}
                className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 px-3 py-1 rounded-xl hover:bg-emerald-100/70 dark:hover:bg-emerald-950/50 transition-colors cursor-pointer"
              >
                <span>{DATE_RANGE_LABELS[dateRange]}</span>
                <ChevronDown size={15} />
              </button>

              {showRangeMenu && (
                <div className="absolute top-11 z-20 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 min-w-[200px] space-y-0.5">
                  {(Object.keys(DATE_RANGE_LABELS) as DateRangeKey[]).map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDateRange(key);
                        setShowRangeMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        dateRange === key
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {DATE_RANGE_LABELS[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Totals Columns */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 py-3.5">
              <div className="text-center px-2 space-y-0.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                  {isCard ? 'Đã thanh toán / Hoàn' : 'Tổng thu'}
                </span>
                <span className="money-mask text-base sm:text-lg font-extrabold text-green-600 dark:text-green-400 block">
                  {formatVND(totalIn)}
                </span>
              </div>
              <div className="text-center px-2 space-y-0.5">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                  {isCard ? 'Tổng chi tiêu qua thẻ' : 'Tổng chi'}
                </span>
                <span className="money-mask text-base sm:text-lg font-extrabold text-rose-500 block">
                  {formatVND(totalOut)}
                </span>
              </div>
            </div>

            {/* Balance / Card Debt Bar */}
            <div className="bg-slate-100/90 dark:bg-slate-800/70 px-4 py-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {isCard ? 'Dư nợ hiện tại' : 'Số dư hiện tại'}
                </span>
                <span
                  className={`money-mask font-extrabold text-sm sm:text-base ${
                    isCard ? 'text-rose-500' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {formatVND(currentBalance)}
                </span>
              </div>
              {isCard && card && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Hạn mức: {formatVND(card.limit)}</span>
                  <span>
                    Khả dụng:{' '}
                    <strong className="money-mask text-green-600 dark:text-green-400">
                      {formatVND(Math.max(0, card.limit - card.currentBalance))}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Day-Grouped Transactions List */}
          {groupedByDate.length === 0 ? (
            <div className="m-4 p-10 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? `Không tìm thấy giao dịch khớp "${searchQuery}"`
                  : `Chưa có giao dịch nào cho ${title} trong ${DATE_RANGE_LABELS[dateRange].toLowerCase()}.`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {dateRange !== 'all' && accountTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDateRange('all')}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                  >
                    Xem tất cả thời gian ({accountTransactions.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 hover:brightness-105 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Ghi giao dịch vào {isCard ? 'thẻ này' : 'ví này'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 sm:space-y-3">
              {groupedByDate.map(([dateStr, items]) => {
                const { dayNum, dayLabel, monthYear } = getDayDetails(dateStr);
                const dayIn = items.filter(i => i.type === 'in').reduce((s, i) => s + i.amount, 0);
                const dayOut = items.filter(i => i.type === 'out').reduce((s, i) => s + i.amount, 0);

                return (
                  <div
                    key={dateStr}
                    className="bg-white dark:bg-slate-900 border-y sm:border border-slate-200/80 dark:border-slate-800 sm:rounded-3xl shadow-xs overflow-hidden"
                  >
                    {/* Day Header */}
                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-8 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full" />
                        <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                          {dayNum}
                        </span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {dayLabel}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {monthYear}
                          </span>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        {dayOut > 0 && (
                          <div className="money-mask text-xs sm:text-sm font-extrabold text-rose-500">
                            {formatVND(dayOut)}
                          </div>
                        )}
                        {dayIn > 0 && (
                          <div className="money-mask text-xs sm:text-sm font-extrabold text-green-600 dark:text-green-400">
                            {formatVND(dayIn)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Transaction Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {items.map(tx => {
                        const cat = categoryMap[tx.cat] || { name: 'Khác' };
                        const isExpense = tx.type === 'out';
                        const runningAfter = afterBalanceMap.get(tx.id);
                        const ben = tx.beneficiary ? beneficiariesMap[tx.beneficiary] : null;

                        return (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() => setEditingTx(tx)}
                            className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <CategoryIcon catKey={tx.cat} size="md" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {cat.name}
                                  </p>
                                  {ben && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      {ben.avatar} {ben.name}
                                    </span>
                                  )}
                                </div>
                                {(tx.note || tx.counterparty || tx.location || tx.tripName || tx.excludeFromReport) && (
                                  <p className="text-xs italic text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {tx.note || ''}
                                    {tx.counterparty ? `${tx.note ? ' · ' : ''}Với ${tx.counterparty}` : ''}
                                    {tx.location ? ` · ${tx.location}` : ''}
                                    {tx.tripName ? ` · ${tx.tripName}` : ''}
                                    {tx.excludeFromReport ? ' · Không tính BC' : ''}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p
                                className={`money-mask font-extrabold text-sm sm:text-base ${
                                  isExpense
                                    ? 'text-rose-500'
                                    : 'text-green-600 dark:text-green-400'
                                }`}
                              >
                                {formatVND(tx.amount)}
                              </p>
                              {runningAfter !== undefined && (
                                <p className="money-mask text-[11px] text-slate-400 dark:text-slate-500">
                                  ({formatVND(runningAfter)})
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating + Add Transaction Button */}
      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="fixed bottom-6 right-5 sm:right-8 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-500 text-white shadow-xl shadow-emerald-600/35 hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer z-20"
        title={`Ghi giao dịch mới cho ${title}`}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {/* Sub-modals for editing or adding directly inside detail view */}
      <EditTransactionModal
        isOpen={editingTx !== null}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
      />

      <AddTransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        initialType="out"
        defaultAccountId={target.id}
      />
    </div>,
    document.body
  );
};
