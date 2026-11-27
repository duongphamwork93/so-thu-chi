import React, { useState } from 'react';
import {
  Camera,
  Sparkles,
  Bot,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Plus,
  Edit3,
  Wallet,
  ChevronDown,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { CategorySelectDropdown } from '../CategorySelectDropdown';
import { calculateNetWorthBreakdown, formatVND, getTodayDateString } from '../../utils/formatters';
import { resolveDefaultPaymentAccountId } from '../../utils/paymentMatcher';
import { BeneficiaryKey } from '../../types/finance';
import { getBeneficiaries } from '../../constants/beneficiaries';
import { CategoryIcon } from '../CategoryIcon';
import { ReceiptScannerPanel } from '../ReceiptScannerPanel';
import { AuditReport } from '../advisor/AuditReport';
import { buildAuditSnapshot } from '../../utils/financialAudit';

export const AIAdvisorView: React.FC = () => {
  const { data, currentMonth, setCurrentMonth, addTransaction, allExpenseCategories, allIncomeCategories, categoryMap } = useFinance();
  const { plus, periodRange } = usePlus();
  const auditSnapshot = React.useMemo(
    () => buildAuditSnapshot({ data, plus, categoryMap, range: periodRange, todayStr: getTodayDateString() }),
    [data, plus, categoryMap, periodRange]
  );

  const beneficiariesList = React.useMemo(
    () => getBeneficiaries(data.settings.memberNames, data.settings.customMembers),
    [data.settings.memberNames, data.settings.customMembers]
  );

  // Tab mode: 'receipt' | 'advisor' | 'quick'
  const [subTab, setSubTab] = useState<'receipt' | 'advisor' | 'quick'>('receipt');

  // 1. Financial Advisor state
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [adviceResult, setAdviceResult] = useState<any | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  // 2. Quick text state
  const [quickInput, setQuickInput] = useState<string>('');
  const [quickResult, setQuickResult] = useState<any | null>(null);
  const [isQuickProcessing, setIsQuickProcessing] = useState<boolean>(false);
  const [hasSavedQuick, setHasSavedQuick] = useState<boolean>(false);
  const [quickForm, setQuickForm] = useState<{
    merchant: string;
    amount: number;
    type: 'in' | 'out';
    category: string;
    date: string;
    accountId: string;
    note: string;
    beneficiary?: BeneficiaryKey;
  } | null>(null);

  // Validate a category key belongs to the selected transaction type
  const resolveValidCategory = (catKey: string | undefined, txType: 'in' | 'out'): string => {
    const list = txType === 'out' ? allExpenseCategories : allIncomeCategories;
    if (catKey && list.some(c => c.key === catKey)) return catKey;
    return txType === 'out' ? 'an_uong' : 'thu_khac';
  };

  // Run AI Financial Advisor
  const handleGenerateAdvice = async () => {
    setIsAnalyzing(true);
    setAdviceError(null);

    try {
      const res = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit: auditSnapshot }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Không thể tạo phân tích tài chính');
      }

      setAdviceResult(json.data);
    } catch (err: any) {
      setAdviceError(err.message || 'Lỗi khi tạo lời khuyên tài chính');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle quick text AI parse
  const handleQuickTextParse = async () => {
    if (!quickInput.trim()) return;
    setIsQuickProcessing(true);

    try {
      const res = await fetch('/api/gemini/quick-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quickInput }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        const raw = json.data || {};
        const isIncome = raw.type === 'in';
        const defaultCat = raw.category || (isIncome ? 'thu_khac' : 'an_uong');
        let detectedBeneficiary: BeneficiaryKey = 'family';
        const lower = quickInput.toLowerCase();
        const matchedCustom = (data.settings.customMembers || []).find(
          m => m.name && lower.includes(m.name.toLowerCase())
        );
        if (matchedCustom) {
          detectedBeneficiary = matchedCustom.id;
        } else if (
          lower.includes('con 1') ||
          lower.includes('bé 1') ||
          (data.settings.memberNames?.child1 && lower.includes(data.settings.memberNames.child1.toLowerCase()))
        ) {
          detectedBeneficiary = 'child1';
        } else if (
          lower.includes('con 2') ||
          lower.includes('bé 2') ||
          (data.settings.memberNames?.child2 && lower.includes(data.settings.memberNames.child2.toLowerCase()))
        ) {
          detectedBeneficiary = 'child2';
        } else if (
          lower.includes('2 con') ||
          lower.includes('hai con') ||
          lower.includes('hai đứa') ||
          lower.includes('2 đứa') ||
          defaultCat === 'con_sua_bim' ||
          defaultCat === 'giao_duc' ||
          defaultCat === 'con_do_dung' ||
          defaultCat === 'con_y_te'
        ) {
          detectedBeneficiary = 'both_children';
        } else if (
          lower.includes('chồng') ||
          lower.includes('anh xã') ||
          lower.includes('cho bố') ||
          (data.settings.memberNames?.spouse && lower.includes(data.settings.memberNames.spouse.toLowerCase()))
        ) {
          detectedBeneficiary = 'spouse';
        } else if (
          lower.includes('cho tôi') ||
          lower.includes('cho mình') ||
          lower.includes('cho mẹ') ||
          (data.settings.memberNames?.me && lower.includes(data.settings.memberNames.me.toLowerCase()))
        ) {
          detectedBeneficiary = 'me';
        }

        setQuickResult(raw);
        const resolvedQuickAcc = resolveDefaultPaymentAccountId({
          type: isIncome ? 'in' : 'out',
          text: `${quickInput} ${raw.merchant || ''} ${raw.note || ''}`,
          data,
        });
        setQuickForm({
          merchant: raw.merchant || raw.note || 'Giao dịch bóc tách',
          amount: Number(raw.amount) || 0,
          type: isIncome ? 'in' : 'out',
          category: resolveValidCategory(defaultCat, isIncome ? 'in' : 'out'),
          date: raw.date || getTodayDateString(),
          accountId: resolvedQuickAcc.accountId,
          note: raw.note || '',
          beneficiary: isIncome ? undefined : detectedBeneficiary,
        });
        setHasSavedQuick(false);
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsQuickProcessing(false);
    }
  };

  const handleSaveQuick = () => {
    if (!quickForm) return;
    const txDate = quickForm.date || getTodayDateString();
    addTransaction({
      type: quickForm.type,
      cat: quickForm.category || (quickForm.type === 'in' ? 'luong' : 'an_uong'),
      amount: Number(quickForm.amount) || 0,
      date: txDate,
      note: `${quickForm.merchant}${quickForm.note && quickForm.note !== quickForm.merchant ? ` - ${quickForm.note}` : ''}`.trim(),
      accountId: quickForm.accountId || undefined,
      beneficiary: quickForm.type === 'out' ? (quickForm.beneficiary || 'family') : undefined,
    });
    const targetMonth = txDate.slice(0, 7);
    if (targetMonth && targetMonth !== currentMonth) {
      setCurrentMonth(targetMonth);
    }
    setHasSavedQuick(true);
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  };

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Header Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-violet-100 via-indigo-50 to-emerald-50 dark:from-violet-950/60 dark:via-indigo-950/50 dark:to-slate-900 text-slate-900 dark:text-white p-5 shadow-sm border border-violet-200/80 dark:border-violet-800/50 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-violet-600/40 border border-violet-200/80 dark:border-white/15 flex items-center justify-center shrink-0 shadow-2xs">
            <Bot size={20} className="text-violet-600 dark:text-violet-300" />
          </div>
          <h2 className="text-base sm:text-lg font-extrabold">Trợ Lý Tài Chính Thông Minh (AI)</h2>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-600 dark:text-violet-200/90 leading-relaxed">
          Quét bóc tách hóa đơn siêu thị, biên lai chuyển khoản ngân hàng bằng hình ảnh hoặc nhận diện câu nói tiếng Việt tự nhiên.
        </p>
      </div>

      {/* 2. Sub Tabs */}
      <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
        <button
          type="button"
          onClick={() => setSubTab('receipt')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'receipt'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Camera size={16} className="shrink-0" />
          <span className="leading-tight">Quét Hóa Đơn</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('advisor')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'advisor'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sparkles size={16} className="shrink-0" />
          <span className="leading-tight">Cố Vấn 6 Hũ & Dòng Tiền</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('quick')}
          className={`min-h-[44px] py-2.5 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            subTab === 'quick'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText size={16} className="shrink-0" />
          <span className="leading-tight">Bóc Tách Văn Bản</span>
        </button>
      </div>

      {/* 3. SUBTAB 1: RECEIPT SCANNER */}
      {subTab === 'receipt' && (
        <ReceiptScannerPanel onSwitchToQuickText={() => setSubTab('quick')} />
      )}

      {/* 4. SUBTAB 2: CỐ VẤN 6 HŨ & DÒNG TIỀN — Báo cáo kiểm toán tài chính cá nhân */}
      {subTab === 'advisor' && (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Kiểm Toán Tài Chính Cá Nhân</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {auditSnapshot.period.label} ({periodRange.rangeLabel}) · Số liệu tính sẵn từ sổ, AI nhận xét theo 6 Hũ & dòng tiền thực tế.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateAdvice}
                disabled={isAnalyzing}
                className="min-h-[46px] px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-2xl shadow-sm hover:from-violet-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                <RefreshCw size={15} className={isAnalyzing ? 'animate-spin' : ''} />
                <span>{isAnalyzing ? 'Đang kiểm toán...' : adviceResult ? 'Kiểm toán lại' : 'Bắt đầu kiểm toán'}</span>
              </button>
            </div>

            {adviceError && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{adviceError} — các số liệu bên dưới vẫn được app tự tính chính xác.</span>
              </div>
            )}
          </div>

          <AuditReport snap={auditSnapshot} ai={adviceResult} isLoading={isAnalyzing} />
        </div>
      )}

      {/* 5. SUBTAB 3: QUICK TEXT BÓC TÁCH */}
      {subTab === 'quick' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Ghi Sổ Bằng Ngôn Ngữ Tự Nhiên
            </h3>
            <p className="text-xs text-slate-400">
              Gõ tự nhiên như nhắn tin: AI sẽ tự tách số tiền, danh mục, thời gian và ghi chú.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={quickInput}
              onChange={e => setQuickInput(e.target.value)}
              placeholder="VD: Chiều nay đổ xăng 80k cây Petrolimex và mua 2 gói bánh 30k ở Winmart thanh toán MoMo"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={handleQuickTextParse}
              disabled={isQuickProcessing || !quickInput.trim()}
              className="w-full min-h-[46px] py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold rounded-2xl shadow-sm hover:from-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.99] transition-all cursor-pointer"
            >
              <Sparkles size={16} />
              <span>{isQuickProcessing ? 'Đang bóc tách...' : 'Phân tích & Điền giao dịch'}</span>
            </button>
          </div>

          {quickForm && (
            <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-violet-200 dark:border-violet-900/60 shadow-md space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Xác Nhận & Chỉnh Sửa Giao Dịch
                    </h4>
                    <p className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                      Bóc tách từ lời nói / văn bản • Bạn có thể tùy chỉnh mọi mục
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickResult(null);
                    setQuickForm(null);
                    setHasSavedQuick(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Đóng"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Loại giao dịch */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Loại Giao Dịch
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickForm(prev => prev ? {
                        ...prev,
                        type: 'out',
                        category: resolveValidCategory(prev.type === 'out' ? prev.category : undefined, 'out')
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      quickForm.type === 'out'
                        ? 'bg-rose-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Chi tiền (Khoản chi)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickForm(prev => prev ? {
                        ...prev,
                        type: 'in',
                        category: resolveValidCategory(prev.type === 'in' ? prev.category : undefined, 'in')
                      } : null);
                    }}
                    className={`min-h-[42px] py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      quickForm.type === 'in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Thu tiền (Khoản thu)
                  </button>
                </div>
              </div>

              {/* Số tiền */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                  <span>Số Tiền (VNĐ)</span>
                  <span className="text-violet-600 dark:text-violet-400 font-bold">
                    {formatVND(quickForm.amount)}
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={quickForm.amount || ''}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setQuickForm(prev => prev ? { ...prev, amount: val } : null);
                    }}
                    placeholder="0"
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    đ
                  </span>
                </div>
              </div>

              {/* Tên giao dịch / Ghi chú */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Tên Giao Dịch / Ghi Chú
                </label>
                <input
                  type="text"
                  value={quickForm.merchant}
                  onChange={e => {
                    const val = e.target.value;
                    setQuickForm(prev => prev ? { ...prev, merchant: val } : null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              {/* Danh mục & Tài khoản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Danh Mục
                  </label>
                  <CategorySelectDropdown
                    type={quickForm.type}
                    value={resolveValidCategory(quickForm.category, quickForm.type)}
                    onChange={val => setQuickForm(prev => (prev ? { ...prev, category: val } : null))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tài Khoản / Thẻ Trừ Tiền
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-slate-400 pointer-events-none">
                      <Wallet size={15} />
                    </div>
                    <select
                      value={quickForm.accountId}
                      onChange={e => {
                        const val = e.target.value;
                        setQuickForm(prev => prev ? { ...prev, accountId: val } : null);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 appearance-none cursor-pointer"
                    >
                      <option value="">-- Không trừ ví/thẻ --</option>
                      <optgroup label="Ví & Tài khoản ngân hàng">
                        {data.accts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            🏦 {acc.name} ({formatVND(acc.balance)})
                          </option>
                        ))}
                      </optgroup>
                      {data.cards.length > 0 && (
                        <optgroup label="Thẻ tín dụng (Ghi nợ chi tiêu)">
                          {data.cards.map(card => (
                            <option key={card.id} value={card.id}>
                              💳 {card.name} (Dư nợ: {formatVND(card.currentBalance)})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Chi Cho Ai (Phân loại cá nhân & con cái) */}
              {quickForm.type === 'out' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Chi Cho Ai (Phân loại thành viên & con cái)
                    </label>
                    <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                      {beneficiariesList.find(b => b.key === (quickForm.beneficiary || 'family'))?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {beneficiariesList.map(b => {
                      const isSelected = (quickForm.beneficiary || 'family') === b.key;
                      return (
                        <button
                          key={b.key}
                          type="button"
                          onClick={() => setQuickForm(prev => prev ? { ...prev, beneficiary: b.key } : null)}
                          className={`p-2.5 rounded-2xl text-left border transition-all flex items-center gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-violet-50 dark:bg-violet-950/60 border-violet-500 dark:border-violet-400 text-violet-900 dark:text-violet-100 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-base shrink-0">{b.avatar}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{b.name}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ngày giao dịch */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Ngày Giao Dịch
                </label>
                <input
                  type="date"
                  value={quickForm.date}
                  onChange={e => {
                    const val = e.target.value;
                    setQuickForm(prev => prev ? { ...prev, date: val } : null);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2">
                {hasSavedQuick ? (
                  <div className="space-y-2">
                    <div className="w-full py-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} />
                      <span>Đã lưu vào sổ thu chi thành công!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickInput('');
                        setQuickResult(null);
                        setQuickForm(null);
                        setHasSavedQuick(false);
                      }}
                      className="w-full min-h-[46px] py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-2xl transition-all cursor-pointer"
                    >
                      Nhập thêm giao dịch khác
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSaveQuick}
                      className="flex-1 min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus size={18} />
                      <span>Lưu Vào Sổ Thu Chi Ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQuickResult(null);
                        setQuickForm(null);
                      }}
                      className="min-h-[48px] px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
