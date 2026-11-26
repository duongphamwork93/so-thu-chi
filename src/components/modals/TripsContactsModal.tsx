import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Compass,
  Users,
  Plus,
  CheckCircle2,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { CategoryIcon } from '../CategoryIcon';
import { formatDateVietnamese, formatVND } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { Transaction, TripEvent } from '../../types/finance';
import { EditTransactionModal } from './EditTransactionModal';

interface TripsContactsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'trips' | 'contacts';
}

export const TripsContactsModal: React.FC<TripsContactsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'trips',
}) => {
  const { data, updateSettings, categoryMap } = useFinance();
  const [activeTab, setActiveTab] = useState<'trips' | 'contacts'>(initialTab);
  const [tripStatusFilter, setTripStatusFilter] = useState<'active' | 'ended'>('active');

  // New trip form
  const [newTripName, setNewTripName] = useState('');
  const [newTripBudget, setNewTripBudget] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Contacts form & filter
  const [newContactName, setNewContactName] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  // Edit transaction inside drill-down
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setExpandedKey(null);
    }
  }, [isOpen, initialTab]);

  const savedTrips = data.settings.savedTrips || [];
  const savedContacts = data.settings.savedContacts || [];

  // Combine saved trips + any ad-hoc tripName found in transactions
  const allTrips = useMemo(() => {
    const map = new Map<string, TripEvent>();
    savedTrips.forEach(t => {
      map.set(t.name.trim().toLowerCase(), t);
    });
    data.records.forEach(tx => {
      if (tx.tripName && tx.tripName.trim()) {
        const key = tx.tripName.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: 'adhoc_' + key,
            name: tx.tripName.trim(),
            ended: false,
          });
        }
      }
    });

    return Array.from(map.values()).map(trip => {
      const txs = data.records
        .filter(r => r.tripName && r.tripName.trim().toLowerCase() === trip.name.trim().toLowerCase())
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const totalOut = txs.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
      const totalIn = txs.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
      return {
        ...trip,
        transactions: txs,
        totalOut,
        totalIn,
      };
    });
  }, [savedTrips, data.records]);

  const displayedTrips = useMemo(
    () => allTrips.filter(t => (tripStatusFilter === 'ended' ? Boolean(t.ended) : !t.ended)),
    [allTrips, tripStatusFilter]
  );

  // Combine saved contacts + counterparties found on transactions
  const allContacts = useMemo(() => {
    const map = new Map<string, { name: string; transactions: Transaction[]; totalOut: number; totalIn: number }>();
    savedContacts.forEach(c => {
      if (c.trim()) {
        map.set(c.trim().toLowerCase(), { name: c.trim(), transactions: [], totalOut: 0, totalIn: 0 });
      }
    });
    data.records.forEach(tx => {
      if (tx.counterparty && tx.counterparty.trim()) {
        const clean = tx.counterparty.trim();
        const key = clean.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name: clean, transactions: [], totalOut: 0, totalIn: 0 });
        }
        const entry = map.get(key)!;
        entry.transactions.push(tx);
        if (tx.type === 'out') entry.totalOut += tx.amount;
        else entry.totalIn += tx.amount;
      }
    });

    return Array.from(map.values())
      .map(c => ({
        ...c,
        transactions: c.transactions.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
      }))
      .filter(c => !contactSearch.trim() || c.name.toLowerCase().includes(contactSearch.trim().toLowerCase()))
      .sort((a, b) => b.totalOut + b.totalIn - (a.totalOut + a.totalIn));
  }, [savedContacts, data.records, contactSearch]);

  if (!isOpen || typeof document === 'undefined' || !document.body) return null;

  const handleAddTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTripName.trim();
    if (!clean) return;
    if (savedTrips.some(t => t.name.toLowerCase() === clean.toLowerCase())) {
      setNewTripName('');
      return;
    }
    const budgetNum = parseCurrencyInput(newTripBudget);
    const nextTrip: TripEvent = {
      id: 'trip_' + Date.now().toString(36),
      name: clean,
      ended: false,
      ...(budgetNum > 0 ? { budget: budgetNum } : {}),
    };
    updateSettings({ savedTrips: [nextTrip, ...savedTrips] });
    setNewTripName('');
    setNewTripBudget('');
  };

  const handleToggleTripEnded = (trip: TripEvent) => {
    const exists = savedTrips.some(t => t.name.toLowerCase() === trip.name.toLowerCase());
    if (exists) {
      updateSettings({
        savedTrips: savedTrips.map(t =>
          t.name.toLowerCase() === trip.name.toLowerCase() ? { ...t, ended: !t.ended } : t
        ),
      });
    } else {
      updateSettings({
        savedTrips: [
          ...savedTrips,
          { id: 'trip_' + Date.now().toString(36), name: trip.name, ended: !trip.ended },
        ],
      });
    }
  };

  const handleDeleteTrip = (tripName: string) => {
    updateSettings({
      savedTrips: savedTrips.filter(t => t.name.toLowerCase() !== tripName.toLowerCase()),
    });
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newContactName.trim();
    if (!clean) return;
    if (!savedContacts.some(c => c.toLowerCase() === clean.toLowerCase())) {
      updateSettings({ savedContacts: [clean, ...savedContacts] });
    }
    setNewContactName('');
  };

  const handleDeleteContact = (name: string) => {
    updateSettings({
      savedContacts: savedContacts.filter(c => c.toLowerCase() !== name.toLowerCase()),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9995] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-800 dark:via-teal-800 dark:to-cyan-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center">
              {activeTab === 'trips' ? <Compass size={19} /> : <Users size={19} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold leading-tight">
                {activeTab === 'trips' ? 'Chuyến Đi & Sự Kiện' : 'Đối Tượng Thu / Chi (Với Ai)'}
              </h2>
              <p className="text-[11px] text-emerald-100">
                {activeTab === 'trips'
                  ? 'Gom nhóm chi tiêu theo chuyến du lịch, đám cưới, dịp Tết...'
                  : 'Theo dõi tổng tiền đã chi tiêu hoặc thu với từng người / đối tác'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Tab Switcher */}
        <div className="px-5 pt-3">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('trips');
                setExpandedKey(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'trips'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Compass size={14} className={activeTab === 'trips' ? 'text-emerald-600' : ''} />
              <span>Chuyến đi / Sự kiện</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('contacts');
                setExpandedKey(null);
              }}
              className={`py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users size={14} className={activeTab === 'contacts' ? 'text-emerald-600' : ''} />
              <span>Với ai (Đối tượng)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {activeTab === 'trips' ? (
            <>
              {/* Add New Trip Form */}
              <form
                onSubmit={handleAddTrip}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 space-y-2"
              >
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newTripName}
                    onChange={e => setNewTripName(e.target.value)}
                    placeholder="Tên chuyến đi / sự kiện (VD: Du lịch Đà Lạt)..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newTripBudget}
                    onChange={e => setNewTripBudget(formatCurrencyInput(e.target.value))}
                    placeholder="Ngân sách (tùy chọn)"
                    className="w-full sm:w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newTripName.trim()}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Tạo Chuyến Đi / Sự Kiện Mới</span>
                </button>
              </form>

              {/* Active vs Ended Sub-tabs */}
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                <button
                  type="button"
                  onClick={() => setTripStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    tripStatusFilter === 'active'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đang theo dõi ({allTrips.filter(t => !t.ended).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTripStatusFilter('ended')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    tripStatusFilter === 'ended'
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Đã kết thúc ({allTrips.filter(t => t.ended).length})
                </button>
              </div>

              {/* Trips List */}
              {displayedTrips.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <Compass size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {tripStatusFilter === 'active'
                      ? 'Chưa có chuyến đi/sự kiện nào đang theo dõi'
                      : 'Chưa có chuyến đi/sự kiện nào đã kết thúc'}
                  </p>
                  <p className="text-[11px] text-slate-400 px-6">
                    Khi ghi giao dịch mới, mở mục "Thêm chi tiết" và chọn tên chuyến đi để thống kê tự động.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedTrips.map(trip => {
                    const isExp = expandedKey === trip.name;
                    const budgetPct =
                      trip.budget && trip.budget > 0
                        ? Math.round((trip.totalOut / trip.budget) * 100)
                        : null;

                    return (
                      <div
                        key={trip.id}
                        className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                      >
                        <div
                          onClick={() => setExpandedKey(isExp ? null : trip.name)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                              {trip.name}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                              {trip.transactions.length} giao dịch
                              {trip.totalIn > 0 && ` · Thu +${formatVND(trip.totalIn)}`}
                            </p>
                            {budgetPct !== null && trip.budget && (
                              <div className="mt-1.5 space-y-0.5">
                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      budgetPct >= 100 ? 'bg-rose-500' : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${Math.min(100, budgetPct)}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  Ngân sách: {formatVND(trip.budget)} ({budgetPct}%)
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="money-mask text-sm font-black text-rose-500 tabular-nums">
                              -{formatVND(trip.totalOut)}
                            </span>
                            {isExp ? (
                              <ChevronUp size={16} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExp && (
                          <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleTripEnded(trip)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
                              >
                                {trip.ended ? (
                                  <>
                                    <RotateCcw size={13} />
                                    <span>Mở lại theo dõi</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    <span>Đánh dấu đã kết thúc</span>
                                  </>
                                )}
                              </button>

                              {savedTrips.some(
                                s => s.name.toLowerCase() === trip.name.toLowerCase()
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTrip(trip.name)}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>Xóa thẻ sự kiện</span>
                                </button>
                              )}
                            </div>

                            {trip.transactions.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                Chưa có giao dịch nào gắn sự kiện này.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                                {trip.transactions.map(tx => {
                                  const cat = categoryMap[tx.cat];
                                  return (
                                    <button
                                      key={tx.id}
                                      type="button"
                                      onClick={() => setEditingTx(tx)}
                                      className="w-full text-left py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-1 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CategoryIcon catKey={tx.cat} size="sm" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {tx.note || cat?.name || 'Giao dịch'}
                                          </p>
                                          <p className="text-[11px] text-slate-400">
                                            {formatDateVietnamese(tx.date)}
                                            {tx.location ? ` · ${tx.location}` : ''}
                                          </p>
                                        </div>
                                      </div>
                                      <span
                                        className={`money-mask text-xs font-extrabold tabular-nums shrink-0 ${
                                          tx.type === 'in'
                                            ? 'text-emerald-600 dark:text-emerald-400'
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
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Contacts Add & Search */}
              <div className="space-y-2.5">
                <form onSubmit={handleAddContact} className="flex gap-2">
                  <input
                    type="text"
                    value={newContactName}
                    onChange={e => setNewContactName(e.target.value)}
                    placeholder="Thêm người / đối tác mới (VD: Anh Nam, Quán Phở)..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="submit"
                    disabled={!newContactName.trim()}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={15} />
                    <span>Thêm</span>
                  </button>
                </form>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Tìm đối tượng thu/chi..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {allContacts.length === 0 ? (
                <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                  <Users size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Chưa có đối tượng thu/chi nào
                  </p>
                  <p className="text-[11px] text-slate-400 px-6">
                    Nhập tên vào mục "Với ai" khi thêm giao dịch hoặc dùng tính năng ghi bằng giọng nói.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {allContacts.map(contact => {
                    const isExp = expandedKey === contact.name;
                    return (
                      <div
                        key={contact.name}
                        className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
                      >
                        <div
                          onClick={() => setExpandedKey(isExp ? null : contact.name)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm flex items-center justify-center shrink-0">
                              {contact.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {contact.name}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {contact.transactions.length} giao dịch
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right tabular-nums">
                              {contact.totalOut > 0 && (
                                <p className="money-mask text-xs font-extrabold text-rose-500">
                                  Chi -{formatVND(contact.totalOut)}
                                </p>
                              )}
                              {contact.totalIn > 0 && (
                                <p className="money-mask text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                  Thu +{formatVND(contact.totalIn)}
                                </p>
                              )}
                              {contact.totalOut === 0 && contact.totalIn === 0 && (
                                <p className="text-xs text-slate-400">0 ₫</p>
                              )}
                            </div>
                            {isExp ? (
                              <ChevronUp size={16} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExp && (
                          <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            {savedContacts.some(
                              c => c.toLowerCase() === contact.name.toLowerCase()
                            ) && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteContact(contact.name)}
                                  className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                  <span>Xóa khỏi danh bạ gợi ý</span>
                                </button>
                              </div>
                            )}
                            {contact.transactions.length === 0 ? (
                              <p className="text-xs text-slate-400 italic">
                                Chưa có giao dịch gắn với {contact.name}.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                                {contact.transactions.map(tx => {
                                  const cat = categoryMap[tx.cat];
                                  return (
                                    <button
                                      key={tx.id}
                                      type="button"
                                      onClick={() => setEditingTx(tx)}
                                      className="w-full text-left py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-1 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <CategoryIcon catKey={tx.cat} size="sm" />
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {tx.note || cat?.name || 'Giao dịch'}
                                          </p>
                                          <p className="text-[11px] text-slate-400">
                                            {formatDateVietnamese(tx.date)}
                                            {tx.location ? ` · ${tx.location}` : ''}
                                          </p>
                                        </div>
                                      </div>
                                      <span
                                        className={`money-mask text-xs font-extrabold tabular-nums shrink-0 ${
                                          tx.type === 'in'
                                            ? 'text-emerald-600 dark:text-emerald-400'
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
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <EditTransactionModal
          isOpen={editingTx !== null}
          onClose={() => setEditingTx(null)}
          transaction={editingTx}
        />
      </div>
    </div>,
    document.body
  );
};
