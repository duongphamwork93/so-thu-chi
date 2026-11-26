import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRightLeft, Check, CreditCard as CardIcon, Calendar, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { formatVND } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { getCardStatementSummary } from '../../utils/creditCardStatement';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToId?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, initialToId }) => {
  const { data, transferMoney, payCreditCard } = useFinance();
  const { plus } = usePlus();

  const [fromId, setFromId] = useState<string>(data.accts[0]?.id || '');
  const [toId, setToId] = useState<string>(initialToId || data.accts[1]?.id || data.cards[0]?.id || '');
  const [amountStr, setAmountStr] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const cardSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCardStatementSummary>>();
    data.cards.forEach(card => {
      map.set(card.id, getCardStatementSummary(card, data.records, undefined, plus.stmtOverrides));
    });
    return map;
  }, [data.cards, data.records, plus.stmtOverrides]);

  const applyCardAutoFill = (targetCardId: string) => {
    const card = data.cards.find(c => c.id === targetCardId);
    if (!card) return;
    const summary = cardSummaries.get(card.id) || getCardStatementSummary(card, data.records, undefined, plus.stmtOverrides);
    const autoAmt = summary.recommendedPaymentAmount;
    setAmountStr(autoAmt > 0 ? formatCurrencyInput(autoAmt) : '');
    setNote(
      summary.remainingDue > 0
        ? `Thanh toán sao kê ${summary.statementMonthLabel} - ${card.name}`
        : `Thanh toán dư nợ thẻ ${card.name}`
    );
  };

  // Sync defaults whenever modal opens or initialToId changes
  useEffect(() => {
    if (!isOpen) return;

    const defaultFrom =
      data.accts.find(a => a.id !== initialToId)?.id || data.accts[0]?.id || '';
    setFromId(defaultFrom);

    const resolvedTo =
      initialToId ||
      data.accts.find(a => a.id !== defaultFrom)?.id ||
      data.cards[0]?.id ||
      '';
    setToId(resolvedTo);

    const isCardDest = data.cards.some(c => c.id === resolvedTo);
    if (isCardDest) {
      applyCardAutoFill(resolvedTo);
    } else {
      setAmountStr('');
      setNote('');
    }
  }, [isOpen, initialToId]);

  if (!isOpen) return null;

  const selectedCard = data.cards.find(c => c.id === toId) || null;
  const selectedCardSummary = selectedCard
    ? cardSummaries.get(selectedCard.id) || getCardStatementSummary(selectedCard, data.records, undefined, plus.stmtOverrides)
    : null;
  const isCardPayment = Boolean(selectedCard);
  const currentAmountNum = parseCurrencyInput(amountStr);

  const handleToChange = (nextToId: string) => {
    setToId(nextToId);
    const nextCard = data.cards.find(c => c.id === nextToId);
    if (nextCard) {
      applyCardAutoFill(nextCard.id);
    } else if (isCardPayment) {
      // Switched away from a credit card back to a normal account
      setAmountStr('');
      setNote('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId || currentAmountNum <= 0) return;

    if (isCardPayment) {
      payCreditCard(toId, fromId, currentAmountNum, note.trim() || undefined);
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.65 },
      });
    } else {
      transferMoney(fromId, toId, currentAmountNum, note.trim() || undefined);
    }
    onClose();
  };

  const handleSwap = () => {
    if (isCardPayment) return;
    const temp = fromId;
    setFromId(toId);
    setToId(temp);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isCardPayment
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                  : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
              }`}
            >
              {isCardPayment ? <CardIcon size={18} /> : <ArrowRightLeft size={18} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {isCardPayment ? 'Thanh Toán Thẻ Tín Dụng' : 'Chuyển Tiền & Trả Thẻ'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isCardPayment
                  ? 'Tự động điền số tiền cần trả theo kỳ sao kê'
                  : 'Chuyển giữa ví hoặc chọn thẻ tín dụng để trả sao kê'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* From -> To selection */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Từ tài khoản / Ví (Trừ tiền)
              </label>
              <select
                value={fromId}
                onChange={e => setFromId(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {data.accts.length === 0 ? (
                  <option value="">Chưa có tài khoản thanh toán</option>
                ) : (
                  data.accts.map(a => (
                    <option key={a.id} value={a.id}>
                      🏦 {a.name} (Số dư: {formatVND(a.balance)})
                    </option>
                  ))
                )}
              </select>
            </div>

            {!isCardPayment && (
              <div className="flex justify-center -my-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 active:rotate-180 transition-all cursor-pointer"
                  title="Đổi chiều chuyển"
                >
                  <ArrowRightLeft size={14} />
                </button>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                {isCardPayment ? 'Thanh toán cho thẻ tín dụng' : 'Đến tài khoản / Thẻ tín dụng'}
              </label>
              <select
                value={toId}
                onChange={e => handleToChange(e.target.value)}
                className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {data.cards.length > 0 && (
                  <optgroup label="Thẻ tín dụng (Tự điền tiền sao kê)">
                    {data.cards.map(card => {
                      const s = cardSummaries.get(card.id) || getCardStatementSummary(card, data.records, undefined, plus.stmtOverrides);
                      const labelDetail =
                        s.remainingDue > 0
                          ? `Sao kê cần trả: ${formatVND(s.remainingDue)}`
                          : s.isPaidInFull
                          ? `Đã trả đủ sao kê • Dư nợ: ${formatVND(card.currentBalance)}`
                          : `Dư nợ: ${formatVND(card.currentBalance)}`;
                      return (
                        <option key={card.id} value={card.id}>
                          💳 {card.name} ({labelDetail})
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                {data.accts.length > 0 && (
                  <optgroup label="Ví & Tài khoản ngân hàng">
                    {data.accts.map(a => (
                      <option key={a.id} value={a.id} disabled={a.id === fromId}>
                        🏦 {a.name} (Số dư: {formatVND(a.balance)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Credit Card Statement Auto-Fill Banner */}
          {selectedCard && selectedCardSummary && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Calendar size={14} />
                  <span>
                    Sao kê {selectedCardSummary.statementMonthLabel} (chốt {selectedCardSummary.statementDateShort})
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Hạn trả {selectedCardSummary.dueDateShort}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white/85 dark:bg-slate-900/70 border border-emerald-100 dark:border-emerald-900/50">
                  <span className="text-[11px] text-slate-500 block">Cần trả theo sao kê</span>
                  {selectedCardSummary.isPaidInFull ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 size={13} />
                      <span>Đã trả đủ</span>
                    </span>
                  ) : (
                    <span className="money-mask font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                      {formatVND(selectedCardSummary.remainingDue)}
                    </span>
                  )}
                </div>
                <div className="p-2 rounded-xl bg-white/85 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block">Tổng dư nợ hiện tại</span>
                  <span className="money-mask font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatVND(selectedCard.currentBalance)}
                  </span>
                </div>
              </div>

              {selectedCardSummary.paidAmount > 0 && !selectedCardSummary.isPaidInFull && (
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Tổng sao kê: <strong>{formatVND(selectedCardSummary.statementBalance)}</strong> • Đã thanh toán:{' '}
                  <strong className="text-emerald-600">{formatVND(selectedCardSummary.paidAmount)}</strong>
                </p>
              )}

              {/* 1-tap statement vs full debt chips */}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {selectedCardSummary.remainingDue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountStr(formatCurrencyInput(selectedCardSummary.remainingDue));
                      setNote(
                        `Thanh toán sao kê ${selectedCardSummary.statementMonthLabel} - ${selectedCard.name}`
                      );
                    }}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      currentAmountNum === selectedCardSummary.remainingDue
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    Trả đủ sao kê ({formatVND(selectedCardSummary.remainingDue)})
                  </button>
                )}
                {selectedCard.currentBalance > selectedCardSummary.remainingDue && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountStr(formatCurrencyInput(selectedCard.currentBalance));
                      setNote(`Thanh toán toàn bộ dư nợ thẻ ${selectedCard.name}`);
                    }}
                    className={`min-h-[34px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      currentAmountNum === selectedCard.currentBalance
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Trả hết dư nợ ({formatVND(selectedCard.currentBalance)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {isCardPayment ? 'Số tiền thanh toán thẻ' : 'Số tiền chuyển'}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                placeholder="0"
                className="w-full min-h-[46px] text-xl font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              />
              <span className="font-bold text-slate-400">₫</span>
            </div>
            {currentAmountNum > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                = {formatVND(currentAmountNum)}
              </p>
            )}
          </div>

          {/* Quick chips for regular transfers */}
          {!isCardPayment && (
            <div className="flex flex-wrap gap-1.5">
              {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmountStr(formatCurrencyInput((currentAmountNum || 0) + val))}
                  className="min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  +{val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                </button>
              ))}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              {isCardPayment ? 'Ghi chú thanh toán thẻ' : 'Ghi chú chuyển tiền'}
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={
                isCardPayment
                  ? 'VD: Thanh toán sao kê thẻ tháng này...'
                  : 'VD: Rút tiền ATM, nạp tiền ví MoMo...'
              }
              className="w-full min-h-[44px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom,20px))] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[46px] py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!fromId || !toId || fromId === toId || currentAmountNum <= 0}
              className={`flex-[2] min-h-[46px] py-2.5 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer ${
                isCardPayment
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Check size={18} />
              <span>{isCardPayment ? 'Thanh Toán Thẻ' : 'Chuyển Tiền'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
