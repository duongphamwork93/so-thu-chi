import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, PiggyBank, ArrowDownRight, CheckCircle2, Wallet, Calendar } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { SavingsDeposit } from '../../types/finance';
import { formatVND, calculateDepositAccrued } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import confetti from 'canvas-confetti';

interface DepositActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  deposit: SavingsDeposit | null;
  mode: 'withdraw' | 'settle'; // 'withdraw' = Rút một phần, 'settle' = Tất toán toàn bộ
}

export const DepositActionModal: React.FC<DepositActionModalProps> = ({
  isOpen,
  onClose,
  deposit,
  mode,
}) => {
  const { data, withdrawPartialDeposit, settleFullDeposit } = useFinance();

  const [withdrawAmountStr, setWithdrawAmountStr] = useState<string>('');
  const [interestAmountStr, setInterestAmountStr] = useState<string>('');
  const [destAccountId, setDestAccountId] = useState<string>('');
  const [note, setNote] = useState<string>('');

  useEffect(() => {
    if (deposit && isOpen) {
      const defaultAcc = data?.accts?.[0]?.id || '';
      setDestAccountId(defaultAcc);

      if (mode === 'settle') {
        const { accrued } = calculateDepositAccrued(deposit);
        setInterestAmountStr(formatCurrencyInput(accrued));
        setNote(`Tất toán sổ tiết kiệm ${deposit.bank}`);
      } else {
        setWithdrawAmountStr('');
        setNote(`Rút một phần gốc sổ tiết kiệm ${deposit.bank}`);
      }
    }
  }, [deposit, isOpen, mode, data?.accts]);

  if (!isOpen || !deposit) return null;

  const currentPrincipal = deposit.amount || 0;
  const withdrawNum = parseCurrencyInput(withdrawAmountStr);
  const interestNum = parseCurrencyInput(interestAmountStr);
  const totalSettleReturn = currentPrincipal + interestNum;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destAccountId) {
      alert('Vui lòng chọn tài khoản / ví nhận tiền.');
      return;
    }

    if (mode === 'withdraw') {
      if (withdrawNum <= 0) {
        alert('Vui lòng nhập số tiền muốn rút.');
        return;
      }
      if (withdrawNum > currentPrincipal) {
        alert('Số tiền rút không được vượt quá số dư gốc hiện tại (' + formatVND(currentPrincipal) + ').');
        return;
      }

      withdrawPartialDeposit(deposit.id, withdrawNum, destAccountId, note.trim());
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      onClose();
    } else {
      // Settle
      settleFullDeposit(deposit.id, destAccountId, interestNum);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      onClose();
    }
  };

  const isWithdraw = mode === 'withdraw';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
              isWithdraw
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isWithdraw ? <ArrowDownRight size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {isWithdraw ? 'Rút Tiền Một Phần' : 'Tất Toán Sổ Tiết Kiệm'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {deposit.bank} • Gốc: {formatVND(currentPrincipal)}
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Deposit Info Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Ngân hàng gửi:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{deposit.bank}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Tiền gốc hiện tại:</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{formatVND(currentPrincipal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Lãi suất & Kỳ hạn:</span>
              <span className="font-semibold text-emerald-600">{deposit.interestRate}%/năm • {deposit.termMonths} tháng</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400">Ngày đáo hạn:</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">{deposit.maturityDate}</span>
            </div>
          </div>

          {/* Mode 1: Withdraw Partial Amount */}
          {isWithdraw ? (
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Số tiền muốn rút từ gốc (VNĐ)
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={withdrawAmountStr}
                  onChange={e => setWithdrawAmountStr(formatCurrencyInput(e.target.value))}
                  placeholder="VD: 10.000.000"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">
                  ₫
                </span>
              </div>
              {withdrawNum > 0 && (
                <div className="flex items-center justify-between text-xs mt-1.5 px-1">
                  <span className="font-bold text-amber-600">
                    = {formatVND(withdrawNum)}
                  </span>
                  <span className="text-slate-400">
                    Gốc còn lại: {formatVND(Math.max(0, currentPrincipal - withdrawNum))}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Settle Full (Gốc + Lãi) */
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Tiền lãi nhận được khi tất toán (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={interestAmountStr}
                    onChange={e => setInterestAmountStr(formatCurrencyInput(e.target.value))}
                    placeholder="VD: 1.500.000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">
                    ₫
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  * Hệ thống đã tính tự động theo lãi suất {deposit.interestRate}%/năm, bạn có thể chỉnh lại theo số thực tế ngân hàng trả.
                </span>
              </div>

              {/* Total Settlement Amount Highlight Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 text-center space-y-0.5">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  Tổng tiền gốc + lãi nhận về:
                </span>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatVND(totalSettleReturn)}
                </div>
              </div>
            </div>
          )}

          {/* Destination Account Selection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Wallet size={14} className="text-slate-400" />
              <span>Chuyển tiền vào tài khoản / ví nào?</span>
            </label>
            <select
              value={destAccountId}
              onChange={e => setDestAccountId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              required
            >
              {(data?.accts || []).map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (Số dư hiện tại: {formatVND(acc.balance)})
                </option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Ghi chú giao dịch
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom,20px))] flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-2xl transition-all cursor-pointer text-center"
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isWithdraw
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              <Check size={16} />
              <span>{isWithdraw ? 'Xác Nhận Rút Tiền' : 'Xác Nhận Tất Toán'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
