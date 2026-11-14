import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check,
  Calendar,
  CreditCard,
  FileText,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  EyeOff,
  Search,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { removeVietnameseAccents } from '../../constants/categories';
import { CategoryIcon } from '../CategoryIcon';
import { formatVND, parseVietnameseMoneyText } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { Transaction, TransactionType, BeneficiaryKey } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
}) => {
  const { updateTransaction, deleteTransaction, updateSettings, data, allExpenseCategories, allIncomeCategories } = useFinance();

  const [type, setType] = useState<TransactionType>('out');
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>('an_uong');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [beneficiary, setBeneficiary] = useState<BeneficiaryKey>('family');

  // Extended fields
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [tripName, setTripName] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [excludeFromReport, setExcludeFromReport] = useState<boolean>(false);
  const [catSearch, setCatSearch] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  const beneficiariesList = useMemo(
    () => getBeneficiaries(data?.settings?.memberNames, data?.settings?.customMembers) || [],
    [data?.settings?.memberNames, data?.settings?.customMembers]
  );

  const activeSavedTrips = useMemo(
    () => (data?.settings?.savedTrips || []).filter(t => !t.ended),
    [data?.settings?.savedTrips]
  );
  const savedContacts = useMemo(
    () => data?.settings?.savedContacts || [],
    [data?.settings?.savedContacts]
  );

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmountStr(formatCurrencyInput(transaction.amount));
      setSelectedCat(transaction.cat);
      setSelectedAccount(transaction.accountId || data?.accts?.[0]?.id || '');
      setDate(transaction.date);
      setNote(transaction.note || '');
      setBeneficiary(transaction.beneficiary || 'family');
      setTripName(transaction.tripName || '');
      setCounterparty(transaction.counterparty || '');
      setLocation(transaction.location || '');
      setExcludeFromReport(Boolean(transaction.excludeFromReport));
      setShowDetails(
        Boolean(
          transaction.tripName ||
            transaction.counterparty ||
            transaction.location ||
            transaction.excludeFromReport
        )
      );
      setCatSearch('');
      setSelectedSection('all');
    }
  }, [transaction, isOpen]);

  const currentCategories = type === 'out' ? (allExpenseCategories || []) : (allIncomeCategories || []);

  const availableSections = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    currentCategories.forEach(c => {
      if (c.section && !seen.has(c.section)) {
        seen.add(c.section);
        list.push(c.section);
      }
    });
    return list;
  }, [currentCategories]);

  const filteredCategories = useMemo(() => {
    const hasSearch = catSearch.trim().length > 0;
    const q = hasSearch ? removeVietnameseAccents(catSearch.trim()) : '';
    return currentCategories.filter(c => {
      if (hasSearch) {
        return (
          removeVietnameseAccents(c.name).includes(q) ||
          removeVietnameseAccents(c.shortName).includes(q) ||
          removeVietnameseAccents(c.section || '').includes(q)
        );
      }
      if (selectedSection !== 'all') {
        return c.section === selectedSection;
      }
      return true;
    });
  }, [currentCategories, catSearch, selectedSection]);

  if (!isOpen || !transaction || typeof document === 'undefined' || !document.body) return null;

  const currentAmountNum = parseCurrencyInput(amountStr) || parseVietnameseMoneyText(amountStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmountNum <= 0) return;

    const cleanTrip = tripName.trim();
    const cleanContact = counterparty.trim();

    updateTransaction(transaction.id, {
      type,
      amount: currentAmountNum,
      cat: selectedCat,
      accountId: selectedAccount || undefined,
      date,
      note: note.trim(),
      beneficiary: type === 'out' ? beneficiary : undefined,
      tripName: cleanTrip || undefined,
      counterparty: cleanContact || undefined,
      location: location.trim() || undefined,
      excludeFromReport: excludeFromReport || undefined,
    });

    const curTrips = data.settings.savedTrips || [];
    const curContacts = data.settings.savedContacts || [];
    const settingsUpdates: any = {};
    if (cleanTrip && !curTrips.some(t => t.name.toLowerCase() === cleanTrip.toLowerCase())) {
      settingsUpdates.savedTrips = [
        ...curTrips,
        { id: 'trip_' + Date.now().toString(36), name: cleanTrip, ended: false },
      ];
    }
    if (cleanContact && !curContacts.some(c => c.toLowerCase() === cleanContact.toLowerCase())) {
      settingsUpdates.savedContacts = [...curContacts, cleanContact];
    }
    if (Object.keys(settingsUpdates).length > 0) {
      updateSettings(settingsUpdates);
    }

    onClose();
  };

  const handleDelete = () => {
    if (confirm('Bạn có chắc chắn muốn xóa giao dịch này không?')) {
      deleteTransaction(transaction.id);
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Chỉnh Sửa Giao Dịch
              </h2>
              <p className="text-[11px] text-slate-400">
                Cập nhật số tiền, danh mục, ví thanh toán hoặc chi tiết mở rộng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100/80 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setType('out');
                setSelectedCat('an_uong');
                setSelectedSection('all');
              }}
              className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                type === 'out'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Tiền chi (Khoản chi)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('in');
                setSelectedCat('luong');
                setSelectedSection('all');
              }}
              className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                type === 'in'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Tiền thu (Khoản thu)
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Số tiền giao dịch
              </label>
              {currentAmountNum > 0 && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {formatVND(currentAmountNum)}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                placeholder="VD: 50.000, 1.500.000"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 tabular-nums"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">
                đ
              </span>
            </div>
          </div>

          {/* Category Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
              Chọn danh mục
            </label>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                placeholder="Tìm hạng mục (VD: ăn sáng, xăng, điện...)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {availableSections.length > 1 && !catSearch.trim() && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedSection('all')}
                  className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                    selectedSection === 'all'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({currentCategories.length})
                </button>
                {availableSections.map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedSection(sec)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer border ${
                      selectedSection === sec
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-2xl">
              {filteredCategories.map(cat => {
                const isSelected = selectedCat === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCat(cat.key)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 scale-95 shadow-xs'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <CategoryIcon catKey={cat.key} size="sm" />
                    <span
                      className={`text-[10px] mt-1 line-clamp-1 ${
                        isSelected ? 'font-bold text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Beneficiary Selector */}
          {type === 'out' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Users size={14} className="text-emerald-600" />
                  <span>Chi cho ai (Cá nhân & Con cái)</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {beneficiariesList.find(b => b.key === beneficiary)?.description}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {beneficiariesList.map(b => {
                  const isSelected = beneficiary === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBeneficiary(b.key)}
                      className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? `${b.bgColor} ${b.borderColor} border-2 ${b.textColor} shadow-xs font-bold`
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base shrink-0">{b.avatar}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight">{b.name}</p>
                        <p className="text-[9px] text-slate-400 truncate leading-tight">{b.shortLabel}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Account Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <CreditCard size={14} />
              <span>Tài khoản / Ví thanh toán / Thẻ</span>
            </label>
            <select
              value={selectedAccount}
              onChange={e => setSelectedAccount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              {(data?.accts || []).length > 0 && (
                <optgroup label="Ví & Tài khoản ngân hàng">
                  {(data?.accts || []).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      🏦 {acc.name} (Số dư: {formatVND(acc.balance)})
                    </option>
                  ))}
                </optgroup>
              )}
              {(data?.cards || []).length > 0 && (
                <optgroup label="Thẻ tín dụng">
                  {(data?.cards || []).map(card => (
                    <option key={card.id} value={card.id}>
                      💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)} / Hạn mức: {formatVND(card.limit)})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Ngày ghi sổ</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Note Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <FileText size={14} />
              <span>Ghi chú</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Cơm tấm sườn bì chả, mua sách..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Collapsible Extended Details */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDetails(prev => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>
                {showDetails
                  ? 'Ẩn chi tiết mở rộng'
                  : 'Chi tiết mở rộng (Chuyến đi, Với ai, Địa điểm, Báo cáo)'}
              </span>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDetails && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Compass size={13} className="text-emerald-600" />
                    <span>Chuyến đi / Sự kiện</span>
                  </label>
                  <input
                    type="text"
                    value={tripName}
                    onChange={e => setTripName(e.target.value)}
                    placeholder="VD: Du lịch Đà Lạt, Tết 2026..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  {activeSavedTrips.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {activeSavedTrips.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setTripName(t.name)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border cursor-pointer ${
                            tripName === t.name
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Users size={13} className="text-teal-600" />
                      <span>Với ai (Đối tượng thu/chi)</span>
                    </label>
                    <input
                      type="text"
                      value={counterparty}
                      onChange={e => setCounterparty(e.target.value)}
                      placeholder="VD: Anh Nam, Chị Lan..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                    {savedContacts.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {savedContacts.slice(0, 5).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCounterparty(c)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border cursor-pointer ${
                              counterparty === c
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <MapPin size={13} className="text-cyan-600" />
                      <span>Địa điểm</span>
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      placeholder="VD: WinMart, Quận 1..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <div className="flex items-start gap-2 min-w-0">
                    <EyeOff size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Không tính vào báo cáo
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Vẫn cập nhật số dư ví/thẻ, không tính vào tổng Thu/Chi tháng
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={excludeFromReport}
                    onChange={e => setExcludeFromReport(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 pb-[max(1.75rem,env(safe-area-inset-bottom,20px))] flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="min-h-[48px] px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm font-bold hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Xóa khoản này</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-2xl active:scale-95 transition-all cursor-pointer text-center"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={currentAmountNum <= 0}
              className="flex-1 min-h-[48px] py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={17} />
              <span>Lưu Thay Đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
