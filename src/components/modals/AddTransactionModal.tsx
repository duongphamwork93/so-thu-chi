import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Check,
  Calendar,
  CreditCard,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Users,
  Mic,
  Search,
  ChevronDown,
  ChevronUp,
  Compass,
  MapPin,
  EyeOff,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { guessCategoryByText, removeVietnameseAccents } from '../../constants/categories';
import { CategoryIcon } from '../CategoryIcon';
import { formatVND, getTodayDateString, parseVietnameseMoneyText } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { resolveDefaultPaymentAccountId } from '../../utils/paymentMatcher';
import { TransactionType, BeneficiaryKey } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { AddCategoryModal } from './AddCategoryModal';
import { ParsedVoiceTransaction } from './VoiceTransactionModal';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  defaultAccountId?: string;
  initialDate?: string;
  prefilledData?: ParsedVoiceTransaction | null;
  onOpenVoice?: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  initialType = 'out',
  defaultAccountId,
  initialDate,
  prefilledData,
  onOpenVoice,
}) => {
  const { addTransaction, updateSettings, data, allExpenseCategories, allIncomeCategories } = useFinance();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedCat, setSelectedCat] = useState<string>(initialType === 'out' ? 'an_uong' : 'luong');
  const [selectedAccount, setSelectedAccount] = useState<string>(() =>
    defaultAccountId || resolveDefaultPaymentAccountId({ type: initialType, data }).accountId
  );
  const [hasManualAccount, setHasManualAccount] = useState<boolean>(Boolean(defaultAccountId));
  const [date, setDate] = useState<string>(initialDate || getTodayDateString());
  const [note, setNote] = useState<string>('');
  const [beneficiary, setBeneficiary] = useState<BeneficiaryKey>('family');
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState<boolean>(false);

  // Extended details (MISA Thêm chi tiết)
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [tripName, setTripName] = useState<string>('');
  const [counterparty, setCounterparty] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [excludeFromReport, setExcludeFromReport] = useState<boolean>(false);

  // Category search & section filter
  const [catSearch, setCatSearch] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');

  // Quick text input
  const [quickInput, setQuickInput] = useState<string>('');
  const [isParsingQuick, setIsParsingQuick] = useState<boolean>(false);

  // Sync state when modal opens (including prefilledData from Voice or initialDate from Calendar)
  useEffect(() => {
    if (!isOpen) return;

    setCatSearch('');
    setSelectedSection('all');
    setQuickInput('');

    if (prefilledData) {
      setType(prefilledData.type);
      setAmountStr(prefilledData.amount > 0 ? formatCurrencyInput(prefilledData.amount) : '');
      setSelectedCat(prefilledData.category || (prefilledData.type === 'in' ? 'luong' : 'an_uong'));
      setDate(prefilledData.date || getTodayDateString());
      setNote(prefilledData.note || '');
      setBeneficiary(prefilledData.beneficiary || 'family');
      setTripName(prefilledData.tripName || '');
      setCounterparty(prefilledData.counterparty || '');
      setLocation(prefilledData.location || '');
      setExcludeFromReport(false);
      setShowDetails(Boolean(prefilledData.tripName || prefilledData.counterparty || prefilledData.location));
      if (prefilledData.accountId) {
        setSelectedAccount(prefilledData.accountId);
        setHasManualAccount(true);
      } else {
        setHasManualAccount(false);
        const resolved = resolveDefaultPaymentAccountId({ type: prefilledData.type, data });
        setSelectedAccount(resolved.accountId);
      }
      return;
    }

    setType(initialType);
    setSelectedCat(initialType === 'out' ? 'an_uong' : 'luong');
    setAmountStr('');
    setNote('');
    setBeneficiary('family');
    setTripName('');
    setCounterparty('');
    setLocation('');
    setExcludeFromReport(false);
    setShowDetails(false);
    setDate(initialDate || getTodayDateString());

    if (defaultAccountId) {
      setHasManualAccount(true);
      setSelectedAccount(defaultAccountId);
    } else {
      setHasManualAccount(false);
      const resolved = resolveDefaultPaymentAccountId({ type: initialType, data });
      setSelectedAccount(resolved.accountId);
    }
  }, [isOpen, initialType, defaultAccountId, initialDate, prefilledData]);

  const autoResolved = useMemo(
    () =>
      resolveDefaultPaymentAccountId({
        type,
        text: `${quickInput} ${note}`,
        data,
      }),
    [type, quickInput, note, data]
  );

  // Automatically pick primary card or matching keyword rule unless user manually overrode dropdown
  useEffect(() => {
    if (!isOpen || hasManualAccount) return;
    if (autoResolved.accountId) {
      setSelectedAccount(autoResolved.accountId);
    }
  }, [isOpen, hasManualAccount, autoResolved.accountId]);

  const beneficiariesList = useMemo(
    () => getBeneficiaries(data?.settings?.memberNames, data?.settings?.customMembers) || [],
    [data?.settings?.memberNames, data?.settings?.customMembers]
  );
  const activeBeneficiary = (beneficiariesList || []).find(b => b.key === beneficiary) || beneficiariesList[0];

  const currentCategories = type === 'out' ? (allExpenseCategories || []) : (allIncomeCategories || []);

  // Top "Hay dùng" categories computed from existing transaction frequency
  const frequentCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.records || []).forEach(r => {
      if (r.type === type && r.cat) {
        counts[r.cat] = (counts[r.cat] || 0) + 1;
      }
    });
    const sorted = [...currentCategories]
      .filter(c => (counts[c.key] || 0) > 0)
      .sort((a, b) => (counts[b.key] || 0) - (counts[a.key] || 0))
      .slice(0, 6);
    if (sorted.length > 0) return sorted;
    return currentCategories.slice(0, 6);
  }, [data?.records, type, currentCategories]);

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

  const activeSavedTrips = useMemo(
    () => (data?.settings?.savedTrips || []).filter(t => !t.ended),
    [data?.settings?.savedTrips]
  );
  const savedContacts = useMemo(
    () => data?.settings?.savedContacts || [],
    [data?.settings?.savedContacts]
  );

  const currentAmountNum = parseCurrencyInput(amountStr) || parseVietnameseMoneyText(amountStr);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const handleQuickParse = async () => {
    if (!quickInput.trim()) return;
    setIsParsingQuick(true);

    try {
      const res = await fetch('/api/gemini/quick-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickInput, currentDate: date }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const parsed = json.data;
          if (parsed.type === 'in' || parsed.type === 'out') {
            setType(parsed.type);
          }
          if (parsed.amount) {
            setAmountStr(formatCurrencyInput(parsed.amount));
          }
          if (parsed.category) {
            setSelectedCat(parsed.category);
            setSelectedSection('all');
            setCatSearch('');
          }
          if (parsed.note) {
            setNote(parsed.note);
          }
          if (parsed.date) {
            setDate(parsed.date);
          }
          const nextType = parsed.type === 'in' || parsed.type === 'out' ? parsed.type : type;
          if (parsed.account) {
            const accMatch =
              data.accts.find(a => a.name.toLowerCase().includes(parsed.account.toLowerCase())) ||
              data.cards.find(c => c.name.toLowerCase().includes(parsed.account.toLowerCase()));
            if (accMatch) {
              setSelectedAccount(accMatch.id);
              setHasManualAccount(true);
            }
          } else {
            const auto = resolveDefaultPaymentAccountId({
              type: nextType,
              text: `${quickInput} ${parsed.note || ''}`,
              data,
            });
            if (auto.accountId) setSelectedAccount(auto.accountId);
          }
          setIsParsingQuick(false);
          return;
        }
      }
    } catch (e) {
      console.warn('AI Quick parse error, falling back to local rule engine:', e);
    }

    const guessedAmount = parseVietnameseMoneyText(quickInput);
    if (guessedAmount > 0) {
      setAmountStr(formatCurrencyInput(guessedAmount));
    }
    const guessedCat = guessCategoryByText(quickInput);
    if (guessedCat) {
      const isInc = allIncomeCategories.some(c => c.key === guessedCat);
      setType(isInc ? 'in' : 'out');
      setSelectedCat(guessedCat);
    }
    const cleanedNote = quickInput
      .replace(/\d+\s*(k|tr|trieu|tỷ|d|đ|vnd|nghin)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanedNote) {
      setNote(cleanedNote.charAt(0).toUpperCase() + cleanedNote.slice(1));
    }

    setIsParsingQuick(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmountNum <= 0) return;

    const cleanTrip = tripName.trim() || undefined;
    const cleanContact = counterparty.trim() || undefined;
    const cleanLocation = location.trim() || undefined;

    addTransaction({
      type,
      cat: selectedCat,
      amount: currentAmountNum,
      date,
      note: note.trim() || undefined,
      accountId: selectedAccount || undefined,
      beneficiary: type === 'out' ? beneficiary : undefined,
      tripName: cleanTrip,
      counterparty: cleanContact,
      location: cleanLocation,
      excludeFromReport: excludeFromReport || undefined,
    });

    // Save newly typed trip or contact into settings for 1-tap reuse
    const curTrips = data.settings.savedTrips || [];
    const curContacts = data.settings.savedContacts || [];
    const updates: any = {};
    if (cleanTrip && !curTrips.some(t => t.name.toLowerCase() === cleanTrip.toLowerCase())) {
      updates.savedTrips = [...curTrips, { id: 'trip_' + Date.now().toString(36), name: cleanTrip, ended: false }];
    }
    if (cleanContact && !curContacts.some(c => c.toLowerCase() === cleanContact.toLowerCase())) {
      updates.savedContacts = [...curContacts, cleanContact];
    }
    if (Object.keys(updates).length > 0) {
      updateSettings(updates);
    }

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ghi Sổ Giao Dịch</h2>
          </div>
          <div className="flex items-center gap-2">
            {onOpenVoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVoice();
                }}
                className="min-h-[38px] px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 active:scale-95 transition-all cursor-pointer"
                title="Ghi bằng giọng nói"
              >
                <Mic size={15} />
                <span>Giọng nói</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100/80 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Quick Natural Text Input + Voice Mic Button */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
              <span className="flex items-center gap-1">
                <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Gõ hoặc nói nhanh tự động điền</span>
              </span>
              <span className="text-[11px] text-slate-400">VD: cơm trưa 45k momo</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={quickInput}
                onChange={e => setQuickInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleQuickParse();
                  }
                }}
                placeholder="Nhập: ăn sáng 35k, xăng 60k..."
                className="flex-1 min-h-[40px] text-xs sm:text-sm bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {onOpenVoice && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVoice();
                  }}
                  className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
                  title="Nói để ghi giao dịch"
                >
                  <Mic size={17} />
                </button>
              )}
              <button
                type="button"
                onClick={handleQuickParse}
                disabled={isParsingQuick || !quickInput.trim()}
                className="min-h-[40px] px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-bold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {isParsingQuick ? 'Đang đọc...' : 'Điền'}
              </button>
            </div>
          </div>

          {/* Type Segmented Buttons */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setType('out');
                setSelectedCat('an_uong');
                setSelectedSection('all');
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                type === 'out'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft size={18} />
              <span>Tiền Ra (Chi tiêu)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setType('in');
                setSelectedCat('luong');
                setSelectedSection('all');
              }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                type === 'in'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight size={18} />
              <span>Tiền Vào (Thu nhập)</span>
            </button>
          </div>

          {/* Big Amount Input */}
          <div className="text-center py-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
              Số tiền giao dịch
            </label>
            <div className="flex items-center justify-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                placeholder="0"
                className="w-full text-center text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white bg-transparent border-0 border-b-2 border-slate-200 dark:border-slate-700 focus:border-emerald-500 dark:focus:border-emerald-400 focus:outline-none pb-1 tabular-nums"
              />
              <span className="text-2xl font-bold text-slate-400">₫</span>
            </div>
            {currentAmountNum > 0 && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                = {formatVND(currentAmountNum)}
              </p>
            )}
          </div>

          {/* Hay dùng + Category Selector Grid */}
          <div className="space-y-2">
            {/* Hay dùng bar */}
            {frequentCategories.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Hay dùng
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {frequentCategories.map(cat => {
                    const isSelected = selectedCat === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setSelectedCat(cat.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <CategoryIcon catKey={cat.key} size="sm" showBackground={false} />
                        <span>{cat.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Chọn hạng mục
              </label>
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(true)}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Thêm loại mới</span>
              </button>
            </div>

            {/* Category search filter */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={catSearch}
                onChange={e => setCatSearch(e.target.value)}
                placeholder="Tìm hạng mục (VD: ăn sáng, xăng, điện, lương...)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Section filter tabs */}
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

            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              {filteredCategories.map(cat => {
                const isSelected = selectedCat === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCat(cat.key)}
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 font-bold scale-[1.02]'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CategoryIcon catKey={cat.key} size="md" />
                    <span className="text-[11px] mt-1 text-center truncate max-w-full leading-tight font-medium">
                      {cat.shortName}
                    </span>
                  </button>
                );
              })}

              {/* Add Custom Category Card Button */}
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(true)}
                className="flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-dashed border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/40 active:scale-95 transition-all group cursor-pointer"
                title="Tạo loại giao dịch mới của riêng bạn"
              >
                <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                  <Plus size={20} strokeWidth={2.5} />
                </div>
                <span className="text-[11px] mt-1 text-center truncate max-w-full leading-tight font-bold text-emerald-700 dark:text-emerald-400">
                  + Thêm loại
                </span>
              </button>
            </div>
          </div>

          {/* Beneficiary Selector: Chi Cho Ai */}
          {type === 'out' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />
                  <span>Khoản chi này cho ai?</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {activeBeneficiary?.shortLabel || activeBeneficiary?.name || 'Chung'}
                </span>
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {(beneficiariesList || []).map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBeneficiary(b.key)}
                    className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      beneficiary === b.key
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 shadow-xs font-bold ring-1 ring-emerald-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{b.avatarText || b.avatar || '👤'}</span>
                    <span className="text-[10px] leading-tight truncate w-full font-bold">
                      {b.shortLabel || b.name}
                    </span>
                  </button>
                ))}
              </div>
              {beneficiary === 'both_children' && (
                <div className="px-2.5 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 text-[11px] text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Khoản này sẽ tự động <strong>chia đôi 50%</strong> cho Con 1 và Con 2 trong báo cáo cá nhân.</span>
                </div>
              )}
            </div>
          )}

          {/* Account / Wallet Selector */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard size={14} className="text-slate-400" />
                <span>Tài khoản / Ví thanh toán</span>
              </label>
              {!hasManualAccount && selectedAccount === autoResolved.accountId && (autoResolved.reason === 'rule' || autoResolved.reason === 'default') && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                  {autoResolved.reason === 'rule'
                    ? `Tự động theo "${autoResolved.matchedKeyword}"`
                    : 'Thẻ thanh toán chính'}
                </span>
              )}
            </div>
            <select
              value={selectedAccount}
              onChange={e => {
                setSelectedAccount(e.target.value);
                setHasManualAccount(true);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
            >
              <option value="">-- Không liên kết ví cụ thể --</option>
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

          {/* Date & Note Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                <Calendar size={14} className="text-slate-400" />
                <span>Ngày ghi sổ</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full max-w-full min-w-0 block box-border bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="min-w-0">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
                <FileText size={14} className="text-slate-400" />
                <span>Ghi chú</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="VD: Cơm tấm sườn bì chả..."
                className="w-full max-w-full min-w-0 block box-border bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Collapsible Extended Details (MISA "Thêm chi tiết") */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDetails(prev => !prev)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>
                {showDetails
                  ? 'Ẩn chi tiết mở rộng'
                  : 'Thêm chi tiết (Chuyến đi, Với ai, Địa điểm, Báo cáo)'}
              </span>
              {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showDetails && (
              <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-3">
                {/* Chuyến đi / Sự kiện */}
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

                {/* Với ai & Địa điểm */}
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
                      placeholder="VD: Siêu thị WinMart, Q1..."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Không tính vào báo cáo */}
                <label className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
                  <div className="flex items-start gap-2 min-w-0">
                    <EyeOff size={15} className="text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Không tính vào báo cáo
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Vẫn cập nhật số dư ví/thẻ, nhưng không cộng vào tổng Thu/Chi tháng
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
          <div className="pt-2 pb-[max(1.75rem,env(safe-area-inset-bottom,20px))] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] py-3 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm active:scale-95 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={currentAmountNum <= 0}
              className="flex-[2] min-h-[48px] py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check size={18} />
              <span>Lưu Giao Dịch</span>
            </button>
          </div>
        </form>
      </div>

      {/* Custom Category Modal */}
      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        initialType={type}
        onCreated={newCatKey => {
          setSelectedCat(newCatKey);
        }}
      />
    </div>,
    document.body
  );
};
