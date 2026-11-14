import React, { useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Wallet,
  ChevronDown,
  Edit3,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatDateVietnamese, formatVND, getTodayDateString } from '../../utils/formatters';
import { Transaction, TransactionType } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { EditTransactionModal } from '../modals/EditTransactionModal';

interface LedgerViewProps {
  onOpenAddModal: (type?: TransactionType) => void;
}

export const LedgerView: React.FC<LedgerViewProps> = ({ onOpenAddModal }) => {
  const {
    data,
    currentMonth,
    deleteTransaction,
    categoryMap,
    allExpenseCategories,
    allIncomeCategories,
  } = useFinance();

  const [typeFilter, setTypeFilter] = useState<'all' | 'out' | 'in'>('all');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const allAvailableCategories = useMemo(
    () => [...allExpenseCategories, ...allIncomeCategories],
    [allExpenseCategories, allIncomeCategories]
  );

  // Filter records for current month + filters
  const filteredRecords = useMemo(() => {
    return data.records.filter(r => {
      // Must match current month
      if (!r.date || !r.date.startsWith(currentMonth)) return false;

      // Filter by type
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;

      // Filter by category
      if (selectedCat !== 'all' && r.cat !== selectedCat) return false;

      // Filter by account
      if (selectedAccount !== 'all' && r.accountId !== selectedAccount) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noteMatch = (r.note || '').toLowerCase().includes(q);
        const catName = (categoryMap[r.cat]?.name || '').toLowerCase();
        const catMatch = catName.includes(q);
        const amountMatch = String(r.amount).includes(q);
        const tripMatch = (r.tripName || '').toLowerCase().includes(q);
        const contactMatch = (r.counterparty || '').toLowerCase().includes(q);
        const locMatch = (r.location || '').toLowerCase().includes(q);
        if (!noteMatch && !catMatch && !amountMatch && !tripMatch && !contactMatch && !locMatch) return false;
      }

      return true;
    });
  }, [data.records, currentMonth, typeFilter, selectedCat, selectedAccount, searchQuery, categoryMap]);

  // Aggregate totals for the filtered results
  const totalFilteredOut = filteredRecords
    .filter(r => r.type === 'out')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalFilteredIn = filteredRecords
    .filter(r => r.type === 'in')
    .reduce((sum, r) => sum + r.amount, 0);

  const beneficiariesMap = useMemo(() => {
    return Object.fromEntries(
      getBeneficiaries(data.settings.memberNames, data.settings.customMembers).map(b => [b.key, b])
    );
  }, [data.settings.memberNames, data.settings.customMembers]);

  // Current balance of selected account or all accounts
  const activeAccountBalance = useMemo(() => {
    if (selectedAccount === 'all') {
      return data.accts.reduce((sum, a) => sum + a.balance, 0);
    }
    const target = data.accts.find(a => a.id === selectedAccount);
    if (target) return target.balance;
    const targetCard = data.cards.find(c => c.id === selectedAccount);
    if (targetCard) return targetCard.limit - targetCard.currentBalance;
    return 0;
  }, [data.accts, data.cards, selectedAccount]);

  // Group records by Date descending
  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof filteredRecords> = {};
    filteredRecords.forEach(r => {
      if (!groups[r.date]) groups[r.date] = [];
      groups[r.date].push(r);
    });

    return Object.entries(groups).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
  }, [filteredRecords]);

  // Helper for MISA day presentation
  const getDayDetails = (dateStr: string) => {
    const parts = (dateStr || '').split('-');
    const dayNum = parts[2] || '01';
    const monthYear = `${parts[1]}/${parts[0]}`;

    const today = getTodayDateString();
    let dayLabel = '';
    if (dateStr === today) {
      dayLabel = 'Hôm nay';
    } else {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
      dayLabel = days[d.getDay()] || '';
    }

    return { dayNum, dayLabel, monthYear };
  };

  return (
    <div className="space-y-4 pb-6">
      {/* 1. MISA TOP SUMMARY CARD (TỔNG THU / TỔNG CHI / SỐ DƯ) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Top Wallet Selector */}
        <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-slate-800/80 dark:to-slate-800/40 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="bg-transparent font-bold text-sm text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              <option value="all" className="dark:bg-slate-900">
                Tất cả ví, tài khoản & thẻ ({data.accts.length + data.cards.length})
              </option>
              <optgroup label="Tài khoản / Ví ngân hàng" className="dark:bg-slate-900">
                {data.accts.map(a => (
                  <option key={a.id} value={a.id} className="dark:bg-slate-900">
                    🏦 {a.name} ({formatVND(a.balance)})
                  </option>
                ))}
              </optgroup>
              {data.cards.length > 0 && (
                <optgroup label="Thẻ tín dụng" className="dark:bg-slate-900">
                  {data.cards.map(c => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      💳 {c.name} (Dư nợ: {formatVND(c.currentBalance)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {filteredRecords.length} giao dịch
          </div>
        </div>

        {/* Dual columns: Tổng thu & Tổng chi */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800 p-4">
          <div className="text-center space-y-0.5 pr-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng thu</span>
            <div className="money-mask text-base sm:text-lg font-black text-green-600 dark:text-green-400">
              {formatVND(totalFilteredIn)}
            </div>
          </div>
          <div className="text-center space-y-0.5 pl-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng chi</span>
            <div className="money-mask text-base sm:text-lg font-black text-rose-500">
              {formatVND(totalFilteredOut)}
            </div>
          </div>
        </div>

        {/* Bottom strip: Số dư hiện tại */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm">
          <span className="text-slate-600 dark:text-slate-400 font-medium">Số dư khả dụng:</span>
          <span className="money-mask font-black text-slate-900 dark:text-white">
            {formatVND(activeAccountBalance)}
          </span>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CHIPS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm theo ghi chú, danh mục, số tiền..."
            className="w-full min-h-[42px] pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {/* Segmented Filter */}
        <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`min-h-[40px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              typeFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            Tất Cả
          </button>
          <button
            onClick={() => setTypeFilter('out')}
            className={`min-h-[40px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
              typeFilter === 'out'
                ? 'bg-rose-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <ArrowDownLeft size={14} />
            <span>Khoản Chi</span>
          </button>
          <button
            onClick={() => setTypeFilter('in')}
            className={`min-h-[40px] py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
              typeFilter === 'in'
                ? 'bg-green-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight size={14} />
            <span>Khoản Thu</span>
          </button>
        </div>

        {/* Category Filter */}
        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          className="w-full min-h-[42px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none truncate cursor-pointer"
        >
          <option value="all">Tất cả danh mục ({allAvailableCategories.length})</option>
          {allAvailableCategories.map(c => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. MISA GROUPED TRANSACTIONS LIST WITH BOLD DAY NUMBER */}
      {groupedByDate.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            Không tìm thấy giao dịch nào phù hợp
          </p>
          <button
            onClick={() => onOpenAddModal()}
            className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} />
            <span>Thêm giao dịch ngay</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateStr, items]) => {
            const { dayNum, dayLabel, monthYear } = getDayDetails(dateStr);
            const dayExpense = items
              .filter(i => i.type === 'out')
              .reduce((sum, i) => sum + i.amount, 0);
            const dayIncome = items
              .filter(i => i.type === 'in')
              .reduce((sum, i) => sum + i.amount, 0);

            return (
              <div
                key={dateStr}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                {/* MISA Day Header Bar */}
                <div className="px-4 py-3 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {/* Left: Big Bold Day Number + Weekday + Month */}
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-cyan-500 dark:bg-cyan-400 rounded-full" />
                    <span className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none">
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

                  {/* Right: Day Totals */}
                  <div className="text-right">
                    {dayExpense > 0 && (
                      <div className="money-mask text-xs sm:text-sm font-black text-rose-500">
                        -{formatVND(dayExpense)}
                      </div>
                    )}
                    {dayIncome > 0 && (
                      <div className="money-mask text-xs font-bold text-green-600 dark:text-green-400">
                        +{formatVND(dayIncome)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-transactions for this day */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {items.map(tx => {
                    const cat = categoryMap[tx.cat] || { name: 'Khác' };
                    const isExpense = tx.type === 'out';
                    const linkedAccount = data.accts.find(a => a.id === tx.accountId);
                    const linkedCard = data.cards.find(c => c.id === tx.accountId);
                    const paymentLabel = linkedAccount ? linkedAccount.name : linkedCard ? `💳 ${linkedCard.name}` : null;
                    const beneficiaryItem = tx.beneficiary ? beneficiariesMap[tx.beneficiary] : null;

                    return (
                      <div
                        key={tx.id}
                        className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Icon & Details */}
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryIcon catKey={tx.cat} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {cat.name}
                              </p>
                              {beneficiaryItem && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {beneficiaryItem.avatar} {beneficiaryItem.name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {tx.note || cat.name}
                              {tx.counterparty ? ` · Với ${tx.counterparty}` : ''}
                              {tx.location ? ` · ${tx.location}` : ''}
                              {tx.tripName ? ` · ${tx.tripName}` : ''}
                              {tx.excludeFromReport ? ' · Không tính BC' : ''}
                            </p>
                          </div>
                        </div>

                        {/* Amount & Account */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <p
                              className={`money-mask font-black text-sm sm:text-base ${
                                isExpense ? 'text-rose-500' : 'text-green-600 dark:text-green-400'
                              }`}
                            >
                              {isExpense ? '-' : '+'}
                              {formatVND(tx.amount)}
                            </p>
                            {paymentLabel && (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[130px]">
                                ({paymentLabel})
                              </p>
                            )}
                          </div>

                          {/* Edit transaction button */}
                          <button
                            type="button"
                            onClick={() => setEditingTx(tx)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800/80 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95 transition-all cursor-pointer"
                            title="Sửa giao dịch này"
                          >
                            <Edit3 size={16} />
                          </button>

                          {/* Delete transaction button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
                                deleteTransaction(tx.id);
                              }
                            }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50/70 dark:bg-rose-950/30 text-rose-500 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/50 active:scale-95 transition-all cursor-pointer"
                            title="Xóa giao dịch này"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        isOpen={editingTx !== null}
        onClose={() => setEditingTx(null)}
        transaction={editingTx}
      />
    </div>
  );
};
