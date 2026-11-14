import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatVND } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { AccountType, DebtDirection, InvestmentType } from '../../types/finance';

export type EditableAssetType = 'account' | 'deposit' | 'holding' | 'card' | 'debt' | 'goal';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetType: EditableAssetType | null;
  assetData: any | null;
}

export const EditAssetModal: React.FC<EditAssetModalProps> = ({
  isOpen,
  onClose,
  assetType,
  assetData,
}) => {
  const {
    updateAccount,
    deleteAccount,
    updateDeposit,
    deleteDeposit,
    updateHolding,
    deleteHolding,
    updateCreditCard,
    deleteCreditCard,
    updateDebt,
    deleteDebt,
    updateGoal,
    deleteGoal,
  } = useFinance();

  // Account states
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accBalanceStr, setAccBalanceStr] = useState('');

  // Deposit states
  const [depBank, setDepBank] = useState('');
  const [depAmountStr, setDepAmountStr] = useState('');
  const [depTerm, setDepTerm] = useState('6');
  const [depRate, setDepRate] = useState('5.2');
  const [depStart, setDepStart] = useState('');
  const [depRollover, setDepRollover] = useState<'all' | 'principal' | 'none'>('all');

  // Holding states
  const [invCode, setInvCode] = useState('');
  const [invName, setInvName] = useState('');
  const [invType, setInvType] = useState<InvestmentType>('stock');
  const [invQtyStr, setInvQtyStr] = useState('');
  const [invBuyPriceStr, setInvBuyPriceStr] = useState('');
  const [invCurPriceStr, setInvCurPriceStr] = useState('');

  // Card states
  const [cardName, setCardName] = useState('');
  const [cardLimitStr, setCardLimitStr] = useState('');
  const [cardBalStr, setCardBalStr] = useState('');
  const [cardStmtDay, setCardStmtDay] = useState('15');
  const [cardDueDay, setCardDueDay] = useState('5');

  // Debt states
  const [debtDir, setDebtDir] = useState<DebtDirection>('lend');
  const [debtName, setDebtName] = useState('');
  const [debtTarget, setDebtTarget] = useState('');
  const [debtAmountStr, setDebtAmountStr] = useState('');
  const [debtPaidStr, setDebtPaidStr] = useState('');
  const [debtDue, setDebtDue] = useState('');

  // Goal states
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalCurrentStr, setGoalCurrentStr] = useState('');
  const [goalDate, setGoalDate] = useState('');

  useEffect(() => {
    if (!assetData || !assetType || !isOpen) return;

    if (assetType === 'account') {
      setAccName(assetData.name || '');
      setAccType(assetData.type || 'bank');
      setAccBalanceStr(formatCurrencyInput(assetData.balance ?? 0));
    } else if (assetType === 'deposit') {
      setDepBank(assetData.bank || '');
      setDepAmountStr(formatCurrencyInput(assetData.amount ?? 0));
      setDepTerm(String(assetData.termMonths || 6));
      setDepRate(String(assetData.interestRate || 5.2));
      setDepStart(assetData.startDate || '');
      setDepRollover(assetData.rollover || 'all');
    } else if (assetType === 'holding') {
      setInvCode(assetData.code || '');
      setInvName(assetData.name || '');
      setInvType(assetData.type || 'stock');
      setInvQtyStr(String(assetData.quantity ?? 0));
      setInvBuyPriceStr(formatCurrencyInput(assetData.buyPrice ?? 0));
      setInvCurPriceStr(formatCurrencyInput(assetData.currentPrice ?? assetData.buyPrice ?? 0));
    } else if (assetType === 'card') {
      setCardName(assetData.name || '');
      setCardLimitStr(formatCurrencyInput(assetData.limit ?? 0));
      setCardBalStr(formatCurrencyInput(assetData.currentBalance ?? 0));
      setCardStmtDay(String(assetData.statementDay || 15));
      setCardDueDay(String(assetData.dueDay || 5));
    } else if (assetType === 'debt') {
      setDebtDir(assetData.dir || 'lend');
      setDebtName(assetData.name || '');
      setDebtTarget(assetData.targetName || '');
      setDebtAmountStr(formatCurrencyInput(assetData.amount ?? 0));
      setDebtPaidStr(formatCurrencyInput(assetData.paidAmount ?? 0));
      setDebtDue(assetData.dueDate || '');
    } else if (assetType === 'goal') {
      setGoalTitle(assetData.title || '');
      setGoalTargetStr(formatCurrencyInput(assetData.targetAmount ?? 0));
      setGoalCurrentStr(formatCurrencyInput(assetData.currentAmount ?? 0));
      setGoalDate(assetData.targetDate || '');
    }
  }, [assetData, assetType, isOpen]);

  if (!isOpen || !assetType || !assetData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (assetType === 'account') {
      const bal = parseCurrencyInput(accBalanceStr);
      if (!accName.trim()) return;
      updateAccount(assetData.id, {
        name: accName.trim(),
        type: accType,
        balance: bal,
      });
    } else if (assetType === 'deposit') {
      const amt = parseCurrencyInput(depAmountStr);
      const term = Number(depTerm) || 6;
      const rate = Number(depRate) || 5;
      if (amt <= 0) return;
      updateDeposit(assetData.id, {
        bank: depBank.trim(),
        amount: amt,
        termMonths: term,
        interestRate: rate,
        startDate: depStart,
        rollover: depRollover,
      });
    } else if (assetType === 'holding') {
      const qty = parseFloat(invQtyStr) || 0;
      const buyP = parseCurrencyInput(invBuyPriceStr);
      const curP = parseCurrencyInput(invCurPriceStr) || buyP;
      if (!invCode.trim() || qty <= 0 || buyP <= 0) return;
      updateHolding(assetData.id, {
        code: invCode.trim().toUpperCase(),
        name: invName.trim() || invCode.trim().toUpperCase(),
        type: invType,
        quantity: qty,
        buyPrice: buyP,
        currentPrice: curP,
      });
    } else if (assetType === 'card') {
      const limit = parseCurrencyInput(cardLimitStr);
      const bal = parseCurrencyInput(cardBalStr);
      if (!cardName.trim() || limit <= 0) return;
      updateCreditCard(assetData.id, {
        name: cardName.trim(),
        limit,
        currentBalance: bal,
        statementDay: Number(cardStmtDay) || 15,
        dueDay: Number(cardDueDay) || 5,
      });
    } else if (assetType === 'debt') {
      const amt = parseCurrencyInput(debtAmountStr);
      const paid = parseCurrencyInput(debtPaidStr);
      if (!debtName.trim() || !debtTarget.trim() || amt <= 0) return;
      updateDebt(assetData.id, {
        dir: debtDir,
        name: debtName.trim(),
        targetName: debtTarget.trim(),
        amount: amt,
        paidAmount: paid,
        dueDate: debtDue || undefined,
      });
    } else if (assetType === 'goal') {
      const targetAmt = parseCurrencyInput(goalTargetStr);
      const curAmt = parseCurrencyInput(goalCurrentStr);
      if (!goalTitle.trim() || targetAmt <= 0) return;
      updateGoal(assetData.id, {
        title: goalTitle.trim(),
        targetAmount: targetAmt,
        currentAmount: curAmt,
        targetDate: goalDate || undefined,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    let name = 'mục tài sản này';
    if (assetType === 'account') name = `tài khoản "${assetData.name}"`;
    if (assetType === 'deposit') name = `sổ tiết kiệm "${assetData.bank}"`;
    if (assetType === 'holding') name = `mã đầu tư "${assetData.code}"`;
    if (assetType === 'card') name = `thẻ tín dụng "${assetData.name}"`;
    if (assetType === 'debt') name = `khoản nợ "${assetData.name}"`;
    if (assetType === 'goal') name = `mục tiêu "${assetData.title}"`;

    if (confirm(`Bạn có chắc chắn muốn xóa ${name} không?`)) {
      if (assetType === 'account') deleteAccount(assetData.id);
      if (assetType === 'deposit') deleteDeposit(assetData.id);
      if (assetType === 'holding') deleteHolding(assetData.id);
      if (assetType === 'card') deleteCreditCard(assetData.id);
      if (assetType === 'debt') deleteDebt(assetData.id);
      if (assetType === 'goal') deleteGoal(assetData.id);
      onClose();
    }
  };

  const getTitle = () => {
    switch (assetType) {
      case 'account':
        return 'Sửa Tài Khoản / Ví';
      case 'deposit':
        return 'Sửa Sổ Tiết Kiệm';
      case 'holding':
        return 'Sửa Mã Đầu Tư / Vàng';
      case 'card':
        return 'Sửa Thẻ Tín Dụng';
      case 'debt':
        return 'Sửa Khoản Vay / Nợ';
      case 'goal':
        return 'Sửa Mục Tiêu Tiết Kiệm';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Sticky Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {getTitle()}
              </h2>
              <p className="text-[11px] text-slate-400">
                Chỉnh sửa số dư, hạn mức hoặc xóa bỏ khi không còn sử dụng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form with Scrollable Body and Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* 1. Account / Wallet Form */}
            {assetType === 'account' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên tài khoản / ví
                  </label>
                  <input
                    type="text"
                    value={accName}
                    onChange={e => setAccName(e.target.value)}
                    placeholder="VD: Vietcombank Lương, Ví MoMo..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Loại tài khoản
                    </label>
                    <select
                      value={accType}
                      onChange={e => setAccType(e.target.value as AccountType)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    >
                      <option value="bank">Ngân hàng</option>
                      <option value="wallet">Ví điện tử (MoMo, ZaloPay...)</option>
                      <option value="cash">Tiền mặt</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số dư hiện tại (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={accBalanceStr}
                      onChange={e => setAccBalanceStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 15.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      required
                    />
                    {parseCurrencyInput(accBalanceStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(accBalanceStr))}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 2. Deposit Form */}
            {assetType === 'deposit' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Ngân hàng gửi tiết kiệm
                  </label>
                  <input
                    type="text"
                    value={depBank}
                    onChange={e => setDepBank(e.target.value)}
                    placeholder="VD: Vietcombank, BIDV, Techcombank..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Số tiền gửi (₫)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={depAmountStr}
                    onChange={e => setDepAmountStr(formatCurrencyInput(e.target.value))}
                    placeholder="VD: 50.000.000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    required
                  />
                  {parseCurrencyInput(depAmountStr) > 0 && (
                    <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                      = {formatVND(parseCurrencyInput(depAmountStr))}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Kỳ hạn (tháng)
                    </label>
                    <select
                      value={depTerm}
                      onChange={e => setDepTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    >
                      {[1, 3, 6, 9, 12, 18, 24, 36].map(m => (
                        <option key={m} value={m}>{m} tháng</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Lãi suất (% / năm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={depRate}
                      onChange={e => setDepRate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Ngày bắt đầu gửi
                  </label>
                  <input
                    type="date"
                    value={depStart}
                    onChange={e => setDepStart(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                {/* Phương thức đáo hạn */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Phương thức đáo hạn
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDepRollover('all')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        depRollover === 'all'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">Quay vòng gốc & lãi</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Tự động tái tục toàn bộ</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepRollover('principal')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        depRollover === 'principal'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">Quay vòng gốc</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Rút lãi về ví, gốc gửi tiếp</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDepRollover('none')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                        depRollover === 'none'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-semibold">Không quay vòng</div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">Tất toán khi hết hạn</div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 3. Holding Form */}
            {assetType === 'holding' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Mã tài sản
                    </label>
                    <input
                      type="text"
                      value={invCode}
                      onChange={e => setInvCode(e.target.value)}
                      placeholder="VD: HPG, SJC, VTI..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold uppercase text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Phân loại
                    </label>
                    <select
                      value={invType}
                      onChange={e => setInvType(e.target.value as InvestmentType)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="stock">Cổ phiếu</option>
                      <option value="gold">Vàng</option>
                      <option value="silver">Bạc</option>
                      <option value="fund">Chứng chỉ quỹ</option>
                      <option value="crypto">Tiền mã hóa (Crypto)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên đầy đủ
                  </label>
                  <input
                    type="text"
                    value={invName}
                    onChange={e => setInvName(e.target.value)}
                    placeholder="VD: Tập đoàn Hòa Phát, Vàng miếng SJC 9999..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số lượng
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={invQtyStr}
                      onChange={e => setInvQtyStr(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Giá mua vào (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={invBuyPriceStr}
                      onChange={e => setInvBuyPriceStr(formatCurrencyInput(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Giá hiện tại (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={invCurPriceStr}
                      onChange={e => setInvCurPriceStr(formatCurrencyInput(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 4. Card Form */}
            {assetType === 'card' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên thẻ tín dụng
                  </label>
                  <input
                    type="text"
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    placeholder="VD: VCB Visa Platinum, Techcombank Spark..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Hạn mức thẻ (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardLimitStr}
                      onChange={e => setCardLimitStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                    {parseCurrencyInput(cardLimitStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(cardLimitStr))}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Dư nợ hiện tại (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={cardBalStr}
                      onChange={e => setCardBalStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 5.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                    {parseCurrencyInput(cardBalStr) > 0 && (
                      <span className="text-[11px] font-bold text-rose-500 mt-1 block">
                        = {formatVND(parseCurrencyInput(cardBalStr))}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Ngày sao kê hàng tháng
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cardStmtDay}
                      onChange={e => setCardStmtDay(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Ngày đến hạn thanh toán
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cardDueDay}
                      onChange={e => setCardDueDay(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 5. Debt Form */}
            {assetType === 'debt' && (
              <>
                <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setDebtDir('lend')}
                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                      debtDir === 'lend' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Tôi cho vay (Thu tiền về)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtDir('borrow')}
                    className={`py-2 text-xs font-bold rounded-xl transition-all ${
                      debtDir === 'borrow' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Tôi đi vay (Cần trả)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Tên khoản nợ
                    </label>
                    <input
                      type="text"
                      value={debtName}
                      onChange={e => setDebtName(e.target.value)}
                      placeholder="VD: Cho mượn, Vay bạn..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Người vay / cho vay
                    </label>
                    <input
                      type="text"
                      value={debtTarget}
                      onChange={e => setDebtTarget(e.target.value)}
                      placeholder="VD: Anh Nam, Bạn Tuấn..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số tiền gốc (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={debtAmountStr}
                      onChange={e => setDebtAmountStr(formatCurrencyInput(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                    {parseCurrencyInput(debtAmountStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(debtAmountStr))}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Đã trả / thu hồi (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={debtPaidStr}
                      onChange={e => setDebtPaidStr(formatCurrencyInput(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Ngày đến hạn (nếu có)
                  </label>
                  <input
                    type="date"
                    value={debtDue}
                    onChange={e => setDebtDue(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </>
            )}

            {/* 6. Goal Form */}
            {assetType === 'goal' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên mục tiêu tích lũy
                  </label>
                  <input
                    type="text"
                    value={goalTitle}
                    onChange={e => setGoalTitle(e.target.value)}
                    placeholder="VD: Quỹ dự phòng, Mua ô tô, Du lịch Nhật..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Mục tiêu cần đạt (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={goalTargetStr}
                      onChange={e => setGoalTargetStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                      required
                    />
                    {parseCurrencyInput(goalTargetStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(goalTargetStr))}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Đã tích lũy hiện tại (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={goalCurrentStr}
                      onChange={e => setGoalCurrentStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 10.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Ngày dự kiến hoàn thành
                  </label>
                  <input
                    type="date"
                    value={goalDate}
                    onChange={e => setGoalDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Sticky Footer Action Buttons - Guaranteed Visible */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[max(1.75rem,env(safe-area-inset-bottom,20px))] shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold hover:bg-rose-100 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 size={15} />
              <span>Xóa</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer text-center"
            >
              Hủy
            </button>

            <button
              type="submit"
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={16} />
              <span>Lưu Thay Đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
