import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Building2, PiggyBank, TrendingUp, CreditCard as CardIcon, HandCoins, Target, Wallet } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { getTodayDateString, formatVND, shiftMonthString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { AccountType, DebtDirection, InvestmentType } from '../../types/finance';

export type AssetCategoryType = 'account' | 'deposit' | 'holding' | 'card' | 'debt' | 'goal';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: AssetCategoryType;
}

export const AddAssetModal: React.FC<AddAssetModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'account',
}) => {
  const { data, addAccount, addDeposit, addHolding, addCreditCard, addDebt, addGoal } = useFinance();
  const [assetType, setAssetType] = useState<AssetCategoryType>(initialCategory);

  // Source account deduction option
  const [deductFromAccount, setDeductFromAccount] = useState<boolean>(true);
  const [sourceAccountId, setSourceAccountId] = useState<string>('');

  // Form states for Account
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('bank');
  const [accBalanceStr, setAccBalanceStr] = useState('');

  // Form states for Deposit
  const [depBank, setDepBank] = useState('Vietcombank');
  const [depAmountStr, setDepAmountStr] = useState('');
  const [depTerm, setDepTerm] = useState('6');
  const [depRate, setDepRate] = useState('5.2');
  const [depStart, setDepStart] = useState(getTodayDateString());
  const [depRollover, setDepRollover] = useState<'all' | 'principal' | 'none'>('all');

  // Form states for Holding
  const [invCode, setInvCode] = useState('');
  const [invName, setInvName] = useState('');
  const [invType, setInvType] = useState<InvestmentType>('stock');
  const [invQtyStr, setInvQtyStr] = useState('100');
  const [invBuyPriceStr, setInvBuyPriceStr] = useState('');
  const [invCurPriceStr, setInvCurPriceStr] = useState('');

  // Form states for Card
  const [cardName, setCardName] = useState('');
  const [cardLimitStr, setCardLimitStr] = useState('50.000.000');
  const [cardBalStr, setCardBalStr] = useState('0');
  const [cardStmtDay, setCardStmtDay] = useState('15');
  const [cardDueDay, setCardDueDay] = useState('5');

  // Form states for Debt
  const [debtDir, setDebtDir] = useState<DebtDirection>('lend');
  const [debtName, setDebtName] = useState('');
  const [debtTarget, setDebtTarget] = useState('');
  const [debtAmountStr, setDebtAmountStr] = useState('');
  const [debtDue, setDebtDue] = useState('');

  // Form states for Goal
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalCurrentStr, setGoalCurrentStr] = useState('0');
  const [goalDate, setGoalDate] = useState('');

  // Sync category and reset form fields on open
  useEffect(() => {
    if (isOpen) {
      setAssetType(initialCategory);
      setAccName('');
      setAccBalanceStr('');
      setDepBank('Vietcombank');
      setDepAmountStr('');
      setDepRollover('all');
      setInvCode('');
      setInvName('');
      setInvBuyPriceStr('');
      setInvCurPriceStr('');
      setCardName('');
      setCardLimitStr(formatCurrencyInput('50000000'));
      setCardBalStr('0');
      setDebtName('');
      setDebtTarget('');
      setDebtAmountStr('');
      setGoalTitle('');
      setGoalTargetStr('');
      setGoalCurrentStr('0');

      if (data?.accts?.length) {
        setSourceAccountId(data.accts[0].id);
      }
      setDeductFromAccount(true);
    }
  }, [isOpen, initialCategory, data?.accts]);

  if (!isOpen) return null;

  const getCategoryMeta = (cat: AssetCategoryType) => {
    switch (cat) {
      case 'card':
        return {
          title: 'Thêm Thẻ Tín Dụng Mới',
          subtitle: 'Thiết lập hạn mức, dư nợ và ngày chốt sao kê / đến hạn',
          icon: CardIcon,
        };
      case 'deposit':
        return {
          title: 'Gửi Sổ Tiết Kiệm Mới',
          subtitle: 'Theo dõi tiền gửi, kỳ hạn, lãi suất và ngày đáo hạn',
          icon: PiggyBank,
        };
      case 'holding':
        return {
          title: 'Thêm Mã Đầu Tư / Cổ Phiếu / Vàng',
          subtitle: 'Theo dõi danh mục đầu tư cổ phiếu, vàng, bạc hoặc quỹ',
          icon: TrendingUp,
        };
      case 'debt':
        return {
          title: 'Thêm Khoản Vay & Nợ Mới',
          subtitle: 'Ghi chép người cho vay, người nợ và lịch thu hồi',
          icon: HandCoins,
        };
      case 'goal':
        return {
          title: 'Tạo Mục Tiêu Tiết Kiệm Mới',
          subtitle: 'Đặt mục tiêu tài chính và theo dõi tiến độ tích lũy',
          icon: Target,
        };
      case 'account':
      default:
        return {
          title: 'Thêm Tài Khoản / Ví Mới',
          subtitle: 'Thêm ví MoMo, ZaloPay, tài khoản ngân hàng hoặc tiền mặt',
          icon: Building2,
        };
    }
  };

  const meta = getCategoryMeta(assetType);
  const CurrentIcon = meta.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (assetType === 'account') {
      const bal = parseCurrencyInput(accBalanceStr);
      if (!accName.trim()) return;
      addAccount({
        name: accName.trim(),
        type: accType,
        balance: bal,
      });
    } else if (assetType === 'deposit') {
      const amt = parseCurrencyInput(depAmountStr);
      const term = Number(depTerm) || 6;
      const rate = Number(depRate) || 5;
      if (amt <= 0) return;

      const maturityDate = shiftMonthString(depStart.slice(0, 7), term) + depStart.slice(7);
      addDeposit(
        {
          bank: depBank.trim(),
          amount: amt,
          termMonths: term,
          interestRate: rate,
          startDate: depStart,
          maturityDate,
          rollover: depRollover,
        },
        deductFromAccount && sourceAccountId ? sourceAccountId : undefined
      );
    } else if (assetType === 'holding') {
      const qty = parseFloat(invQtyStr) || 0;
      const buyP = parseCurrencyInput(invBuyPriceStr);
      const curP = parseCurrencyInput(invCurPriceStr) || buyP;
      if (!invCode.trim() || qty <= 0 || buyP <= 0) return;

      addHolding(
        {
          code: invCode.trim().toUpperCase(),
          name: invName.trim() || invCode.trim().toUpperCase(),
          type: invType,
          quantity: qty,
          buyPrice: buyP,
          currentPrice: curP,
        },
        deductFromAccount && sourceAccountId ? sourceAccountId : undefined
      );
    } else if (assetType === 'card') {
      const limit = parseCurrencyInput(cardLimitStr);
      const bal = parseCurrencyInput(cardBalStr);
      if (!cardName.trim() || limit <= 0) return;

      addCreditCard({
        name: cardName.trim(),
        bank: cardName.trim().split(' ')[0] || 'Ngân hàng',
        limit,
        currentBalance: bal,
        statementDay: Number(cardStmtDay) || 15,
        dueDay: Number(cardDueDay) || 5,
      });
    } else if (assetType === 'debt') {
      const amt = parseCurrencyInput(debtAmountStr);
      if (!debtName.trim() || !debtTarget.trim() || amt <= 0) return;

      addDebt(
        {
          dir: debtDir,
          name: debtName.trim(),
          targetName: debtTarget.trim(),
          amount: amt,
          paidAmount: 0,
          dueDate: debtDue || undefined,
        },
        debtDir === 'lend' && deductFromAccount && sourceAccountId ? sourceAccountId : undefined
      );
    } else if (assetType === 'goal') {
      const targetAmt = parseCurrencyInput(goalTargetStr);
      const curAmt = parseCurrencyInput(goalCurrentStr);
      if (!goalTitle.trim() || targetAmt <= 0) return;

      addGoal({
        title: goalTitle.trim(),
        targetAmount: targetAmt,
        currentAmount: curAmt,
        targetDate: goalDate || undefined,
      });
    }

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Sticky Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CurrentIcon size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {meta.title}
              </h2>
              <p className="text-[11px] text-slate-400">
                {meta.subtitle}
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

        {/* Scrollable Form Body */}
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
                    required
                    value={accName}
                    onChange={e => setAccName(e.target.value)}
                    placeholder="VD: Vietcombank Lương, Ví MoMo..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Loại tài khoản
                    </label>
                    <select
                      value={accType}
                      onChange={e => setAccType(e.target.value as AccountType)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="bank">Ngân hàng</option>
                      <option value="wallet">Ví điện tử (MoMo, ZaloPay)</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="invest">Tài khoản chứng khoán</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số dư hiện tại (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={accBalanceStr}
                      onChange={e => setAccBalanceStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 15.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
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
                    required
                    value={depBank}
                    onChange={e => setDepBank(e.target.value)}
                    placeholder="VD: Vietcombank, MB Bank, Techcombank..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số tiền gửi (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={depAmountStr}
                      onChange={e => setDepAmountStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                    {parseCurrencyInput(depAmountStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(depAmountStr))}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Lãi suất (% / năm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={depRate}
                      onChange={e => setDepRate(e.target.value)}
                      placeholder="5.2"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Kỳ hạn (tháng)
                    </label>
                    <select
                      value={depTerm}
                      onChange={e => setDepTerm(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="1">1 tháng</option>
                      <option value="3">3 tháng</option>
                      <option value="6">6 tháng</option>
                      <option value="9">9 tháng</option>
                      <option value="12">12 tháng (1 năm)</option>
                      <option value="18">18 tháng</option>
                      <option value="24">24 tháng (2 năm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Ngày bắt đầu gửi
                    </label>
                    <input
                      type="date"
                      required
                      value={depStart}
                      onChange={e => setDepStart(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
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

                {/* Trừ tiền từ tài khoản / ví */}
                {data.accts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductFromAccount}
                        onChange={e => setDeductFromAccount(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Trừ tiền từ tài khoản / ví thanh toán
                      </span>
                    </label>

                    {deductFromAccount && (
                      <div className="pt-1">
                        <select
                          value={sourceAccountId}
                          onChange={e => setSourceAccountId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          {data.accts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (Số dư: {formatVND(acc.balance)})
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-400 mt-1">
                          * Tự động trừ {depAmountStr ? formatVND(parseCurrencyInput(depAmountStr)) : '0 ₫'} khỏi tài khoản và ghi nhận một khoản chi tiêu tiết kiệm.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 3. Holding Form */}
            {assetType === 'holding' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Mã / Ký hiệu
                    </label>
                    <input
                      type="text"
                      required
                      value={invCode}
                      onChange={e => setInvCode(e.target.value)}
                      placeholder="VD: FPT, DCDS, SJC..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Loại đầu tư
                    </label>
                    <select
                      value={invType}
                      onChange={e => setInvType(e.target.value as InvestmentType)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="stock">Cổ phiếu</option>
                      <option value="fund">Chứng chỉ quỹ (ETF/Mở)</option>
                      <option value="gold">Vàng (SJC/Nhẫn 9999)</option>
                      <option value="silver">Bạc (Bạc 999/Bạc thỏi)</option>
                      <option value="real_estate">Bất động sản</option>
                      <option value="crypto">Tài sản số (Crypto)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Preset Chips */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-medium">Gợi ý chọn nhanh mã tài sản:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { code: 'FPT', name: 'Cổ phiếu FPT Corp', type: 'stock' as InvestmentType, cur: '138500' },
                      { code: 'HPG', name: 'Cổ phiếu Hòa Phát', type: 'stock' as InvestmentType, cur: '27400' },
                      { code: 'VCB', name: 'Cổ phiếu Vietcombank', type: 'stock' as InvestmentType, cur: '91500' },
                      { code: 'SJC', name: 'Vàng miếng SJC 999.9 (chỉ)', type: 'gold' as InvestmentType, cur: '8850000' },
                      { code: 'VANG9999', name: 'Vàng nhẫn tròn 999.9 (chỉ)', type: 'gold' as InvestmentType, cur: '8750000' },
                      { code: 'BAC', name: 'Bạc 999 Phú Quý (lượng)', type: 'silver' as InvestmentType, cur: '1080000' },
                      { code: 'BAC_THOI', name: 'Bạc thỏi (10 lượng / cây)', type: 'silver' as InvestmentType, cur: '10800000' },
                    ].map(chip => (
                      <button
                        key={chip.code}
                        type="button"
                        onClick={() => {
                          setInvCode(chip.code);
                          setInvName(chip.name);
                          setInvType(chip.type);
                          setInvCurPriceStr(formatCurrencyInput(chip.cur));
                          if (!invBuyPriceStr) setInvBuyPriceStr(formatCurrencyInput(chip.cur));
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        +{chip.code}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên đầy đủ tài sản
                  </label>
                  <input
                    type="text"
                    value={invName}
                    onChange={e => setInvName(e.target.value)}
                    placeholder="VD: Cổ phiếu FPT, Vàng nhẫn 9999 PNJ..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số lượng
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={invQtyStr}
                      onChange={e => setInvQtyStr(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Giá mua (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={invBuyPriceStr}
                      onChange={e => setInvBuyPriceStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 120.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
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
                      placeholder="VD: 135.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Total investment cost preview */}
                {parseFloat(invQtyStr) > 0 && parseCurrencyInput(invBuyPriceStr) > 0 && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 flex justify-between items-center px-1">
                    <span>Tổng vốn đầu tư ban đầu:</span>
                    <span className="font-bold text-emerald-600">
                      {formatVND(Math.round((parseFloat(invQtyStr) || 0) * parseCurrencyInput(invBuyPriceStr)))}
                    </span>
                  </div>
                )}

                {/* Trừ tiền từ tài khoản / ví */}
                {data.accts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductFromAccount}
                        onChange={e => setDeductFromAccount(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Trừ tiền mua đầu tư từ tài khoản / ví
                      </span>
                    </label>

                    {deductFromAccount && (
                      <div className="pt-1">
                        <select
                          value={sourceAccountId}
                          onChange={e => setSourceAccountId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          {data.accts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (Số dư: {formatVND(acc.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 4. Credit Card Form */}
            {assetType === 'card' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên thẻ tín dụng
                  </label>
                  <input
                    type="text"
                    required
                    value={cardName}
                    onChange={e => setCardName(e.target.value)}
                    placeholder="VD: HSBC Visa Platinum, VCB Cashback..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Hạn mức tín dụng (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={cardLimitStr}
                      onChange={e => setCardLimitStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
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
                      placeholder="0"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
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
                      Ngày chốt sao kê hàng tháng
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cardStmtDay}
                      onChange={e => setCardStmtDay(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Ngày hạn thanh toán hàng tháng
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cardDueDay}
                      onChange={e => setCardDueDay(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 5. Debt Form */}
            {assetType === 'debt' && (
              <>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDebtDir('lend')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      debtDir === 'lend'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Cho người khác vay (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtDir('borrow')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      debtDir === 'borrow'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Mình đi vay / Trả góp (-)
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Mô tả khoản nợ
                    </label>
                    <input
                      type="text"
                      required
                      value={debtName}
                      onChange={e => setDebtName(e.target.value)}
                      placeholder="VD: Cho Tuấn mượn, Trả góp xe"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      {debtDir === 'lend' ? 'Người vay tiền' : 'Chủ nợ / Bên cho vay'}
                    </label>
                    <input
                      type="text"
                      required
                      value={debtTarget}
                      onChange={e => setDebtTarget(e.target.value)}
                      placeholder="VD: Nguyễn Văn A, FE Credit..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Tổng số tiền (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={debtAmountStr}
                      onChange={e => setDebtAmountStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 5.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                    {parseCurrencyInput(debtAmountStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(debtAmountStr))}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Hạn hẹn trả
                    </label>
                    <input
                      type="date"
                      value={debtDue}
                      onChange={e => setDebtDue(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Trừ tiền cho vay từ tài khoản / ví nếu cho vay */}
                {debtDir === 'lend' && data.accts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={deductFromAccount}
                        onChange={e => setDeductFromAccount(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Trừ tiền cho vay từ tài khoản / ví
                      </span>
                    </label>

                    {deductFromAccount && (
                      <div className="pt-1">
                        <select
                          value={sourceAccountId}
                          onChange={e => setSourceAccountId(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          {data.accts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} (Số dư: {formatVND(acc.balance)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* 6. Goal Form */}
            {assetType === 'goal' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tên mục tiêu tiết kiệm
                  </label>
                  <input
                    type="text"
                    required
                    value={goalTitle}
                    onChange={e => setGoalTitle(e.target.value)}
                    placeholder="VD: Mua xe máy mới, Quỹ dự phòng..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
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
                      required
                      value={goalTargetStr}
                      onChange={e => setGoalTargetStr(formatCurrencyInput(e.target.value))}
                      placeholder="VD: 50.000.000"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                    {parseCurrencyInput(goalTargetStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(goalTargetStr))}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                      Số tiền hiện đã có (₫)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={goalCurrentStr}
                      onChange={e => setGoalCurrentStr(formatCurrencyInput(e.target.value))}
                      placeholder="0"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                    {parseCurrencyInput(goalCurrentStr) > 0 && (
                      <span className="text-[11px] font-bold text-emerald-600 mt-1 block">
                        = {formatVND(parseCurrencyInput(goalCurrentStr))}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Thời hạn dự kiến hoàn thành
                  </label>
                  <input
                    type="date"
                    value={goalDate}
                    onChange={e => setGoalDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Sticky Footer */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[max(1.75rem,env(safe-area-inset-bottom,20px))] shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer text-center"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Check size={18} />
              <span>Thêm Ngay</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
