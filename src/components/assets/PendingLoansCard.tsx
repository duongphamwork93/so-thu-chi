import React, { useMemo } from 'react';
import { Check, HandCoins } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { getPendingLoans, PendingLoan } from '../../utils/loans';
import { defaultBufferAccountId } from '../../utils/incomeBuffer';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { showToast } from '../../utils/toast';

const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

/** Thẻ "Khoản Mua Hộ Chờ Thu Hồi" — 1 chạm "Đã nhận tiền" để ghi Thu nợ (trung tính) và gạch khoản. */
export const PendingLoansCard: React.FC = () => {
  const { data, addTransaction } = useFinance();
  const { plus, updatePlus } = usePlus();
  const todayStr = getTodayDateString();
  const loans = useMemo(() => getPendingLoans(data, plus, todayStr), [data, plus, todayStr]);

  if (loans.length === 0) return null;

  const receiveAccountId = plus.buffer.accountId || defaultBufferAccountId(data);
  const receiveName = data.accts.find(a => a.id === receiveAccountId)?.name || 'ví';
  const total = loans.reduce((s, l) => s + l.amount, 0);

  const markReceived = (l: PendingLoan) => {
    const tx = addTransaction({
      type: 'in',
      cat: 'thu_no',
      amount: l.amount,
      date: todayStr,
      note: `Thu tiền mua hộ: ${l.person}${l.item ? ` – ${l.item}` : ''}`,
      counterparty: l.person !== 'Chưa ghi tên' ? l.person : undefined,
      accountId: receiveAccountId,
      // Trung tính: hoàn lại tiền đã ứng, không phải thu nhập mới
      excludeFromReport: true,
    });
    updatePlus(prev => ({ loanSettled: { ...prev.loanSettled, [l.txId]: tx.id } }));
    showToast('success', `Đã nhận ${formatVND(l.amount)} từ ${l.person}`, `Cộng vào ${receiveName} · không tính là thu nhập.`);
  };

  return (
    <section className="bg-amber-50/80 dark:bg-amber-950/30 rounded-3xl p-4 sm:p-5 border border-amber-200 dark:border-amber-800 shadow-sm space-y-3">
      <div className="flex items-start gap-2">
        <HandCoins size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-snug">
            Khoản Mua Hộ Chờ Thu Hồi{' '}
            <span className="text-amber-700 dark:text-amber-300">
              (Tổng: <span className="money-mask">{formatVND(total)}</span>)
            </span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Bấm "Đã nhận tiền" để ghi khoản thu vào {receiveName} (trung tính, không tính vào thu nhập).
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {loans.map(l => (
          <li
            key={l.txId}
            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-100 dark:border-amber-900/50 flex items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{l.person}</p>
              {l.item && <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug break-words">{l.item}</p>}
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dm(l.date)} · {l.daysAgo} ngày trước{l.sourceName ? ` · ${l.sourceName}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="money-mask text-sm font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                {formatVND(l.amount)}
              </span>
              <button
                type="button"
                onClick={() => markReceived(l)}
                className="min-h-[36px] px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <Check size={14} /> Đã nhận tiền
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
