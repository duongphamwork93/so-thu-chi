import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, Pencil, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { addDays } from '../../utils/period';
import { showToast } from '../../utils/toast';

/** Lấy mã khoản định kỳ từ mã giao dịch "tx_rec_<recId>_<YYYYMM>". */
const recIdFromTxId = (txId: string) => txId.replace(/^tx_rec_/, '').replace(/_\d{6}$/, '');

interface AutoPostedBannerProps {
  onOpenManager: () => void;
}

/** Thông báo các khoản định kỳ vừa được tự động ghi sổ (10 ngày gần nhất), kèm nút sửa số tiền. */
export const AutoPostedBanner: React.FC<AutoPostedBannerProps> = ({ onOpenManager }) => {
  const { data, updateTransaction, updateRecurring } = useFinance();
  const { plus, updatePlus } = usePlus();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const todayStr = getTodayDateString();
  const items = useMemo(() => {
    const from = addDays(todayStr, -10);
    return data.records
      .filter(r => r.id.startsWith('tx_rec_') && r.date >= from && r.date <= todayStr && !plus.dismissedAutoTx[r.id])
      .slice(0, 4);
  }, [data.records, plus.dismissedAutoTx, todayStr]);

  if (items.length === 0) return null;

  const sourceName = (id?: string) =>
    data.cards.find(c => c.id === id)?.name ? `thẻ ${data.cards.find(c => c.id === id)!.name}` : data.accts.find(a => a.id === id)?.name || '';

  const dismiss = (id: string) => updatePlus(prev => ({ dismissedAutoTx: { ...prev.dismissedAutoTx, [id]: true } }));

  const saveAmount = (txId: string, oldAmount: number) => {
    const amt = parseCurrencyInput(amountStr);
    if (amt <= 0) return;
    if (amt !== oldAmount) updateTransaction(txId, { amount: amt });
    const recId = recIdFromTxId(txId);
    if (saveAsDefault && data.recs.some(r => r.id === recId)) updateRecurring(recId, { amount: amt });
    showToast('success', `Đã sửa thành ${formatVND(amt)}`, saveAsDefault ? 'Đã lưu làm số tiền mặc định các tháng sau.' : undefined);
    setEditingId(null);
  };

  return (
    <div className="space-y-2">
      {items.map(tx => (
        <div
          key={tx.id}
          className="p-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-100"
        >
          <div className="flex items-start gap-2">
            <CalendarClock size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="flex-1 leading-snug">
              Đã tự động ghi nhận: <strong>{tx.note}</strong>{' '}
              <strong className="money-mask">{formatVND(tx.amount)}</strong>
              {sourceName(tx.accountId) ? ` vào ${sourceName(tx.accountId)}` : ''} ({tx.date.slice(8, 10)}/{tx.date.slice(5, 7)})
            </p>
            <button
              type="button"
              onClick={() => dismiss(tx.id)}
              className="w-7 h-7 -mt-1 -mr-1 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer shrink-0"
              aria-label="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </div>

          {editingId === tx.id ? (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  inputMode="numeric"
                  value={amountStr}
                  onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-sm font-bold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => saveAmount(tx.id, tx.amount)}
                  className="min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Check size={14} /> Lưu
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-emerald-600"
                  checked={saveAsDefault}
                  onChange={e => setSaveAsDefault(e.target.checked)}
                />
                <span>Dùng số này làm mặc định cho các tháng sau</span>
              </label>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingId(tx.id);
                  setAmountStr(formatCurrencyInput(tx.amount));
                  setSaveAsDefault(false);
                }}
                className="min-h-[34px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Pencil size={13} /> Sửa số tiền
              </button>
              <button
                type="button"
                onClick={onOpenManager}
                className="min-h-[34px] px-3 rounded-xl font-semibold underline-offset-2 hover:underline cursor-pointer"
              >
                Quản lý định kỳ
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
