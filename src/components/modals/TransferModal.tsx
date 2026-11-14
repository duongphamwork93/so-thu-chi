import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRightLeft, Check, Calendar, FileText } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose }) => {
  const { data, transferMoney } = useFinance();

  const [fromId, setFromId] = useState<string>(data.accts[0]?.id || '');
  const [toId, setToId] = useState<string>(data.accts[1]?.id || data.accts[0]?.id || '');
  const [amountStr, setAmountStr] = useState<string>('');
  const [note, setNote] = useState<string>('');

  if (!isOpen) return null;

  const currentAmountNum = parseCurrencyInput(amountStr);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId || currentAmountNum <= 0) return;

    transferMoney(fromId, toId, currentAmountNum, note.trim() || undefined);
    onClose();
  };

  const handleSwap = () => {
    const temp = fromId;
    setFromId(toId);
    setToId(temp);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-bottom duration-200 overflow-hidden">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ArrowRightLeft size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chuyển Tiền Giữa Ví</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* From -> To selection */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Từ tài khoản (Trừ tiền)
              </label>
              <select
                value={fromId}
                onChange={e => setFromId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              >
                {data.accts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} (Số dư: {formatVND(a.balance)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center -my-1">
              <button
                type="button"
                onClick={handleSwap}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 active:rotate-180 transition-all"
                title="Đổi chiều chuyển"
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                Đến tài khoản (Cộng tiền)
              </label>
              <select
                value={toId}
                onChange={e => setToId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
              >
                {data.accts.map(a => (
                  <option key={a.id} value={a.id} disabled={a.id === fromId}>
                    {a.name} (Số dư: {formatVND(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Số tiền chuyển
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                placeholder="0"
                className="w-full text-xl font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none"
              />
              <span className="font-bold text-slate-400">₫</span>
            </div>
            {currentAmountNum > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                = {formatVND(currentAmountNum)}
              </p>
            )}
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-1.5">
            {[100000, 200000, 500000, 1000000, 2000000, 5000000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountStr(formatCurrencyInput((currentAmountNum || 0) + val))}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                +{val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
              </button>
            ))}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
              Ghi chú chuyển tiền
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="VD: Rút tiền ATM, nạp tiền ví MoMo..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom,20px))] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!fromId || !toId || fromId === toId || currentAmountNum <= 0}
              className="flex-[2] py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={18} />
              <span>Chuyển Tiền</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
