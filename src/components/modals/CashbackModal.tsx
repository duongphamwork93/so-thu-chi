import React, { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { formatVND, getTodayDateString } from '../../utils/formatters';
import { showToast } from '../../utils/toast';

interface CashbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string | null;
}

export const CashbackModal: React.FC<CashbackModalProps> = ({ isOpen, onClose, cardId }) => {
  const { data, addTransaction } = useFinance();
  const { updatePlus } = usePlus();
  const card = data.cards.find(c => c.id === cardId);

  const [amountStr, setAmountStr] = useState('');
  const [mode, setMode] = useState<'card' | 'nec'>('card');
  const [kind, setKind] = useState<'cashback' | 'voucher'>('cashback');
  const [accountId, setAccountId] = useState<string>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setAmountStr('');
    setMode('card');
    setKind('cashback');
    setAccountId('');
    setNote('');
  }, [isOpen]);

  if (!card) return null;
  const amount = parseCurrencyInput(amountStr);

  const handleSave = () => {
    if (amount <= 0) return;
    const label = kind === 'cashback' ? 'Hoàn tiền' : 'Voucher quy đổi';
    const fullNote = `${label} thẻ ${card.name}${note.trim() ? ` · ${note.trim()}` : ''}`;
    if (mode === 'card') {
      addTransaction({
        type: 'in',
        cat: 'hoan_tien',
        amount,
        date: getTodayDateString(),
        note: fullNote,
        accountId: card.id,
        excludeFromReport: true,
      });
      showToast('success', `Đã trừ ${formatVND(amount)} vào dư nợ thẻ ${card.name}`, 'Không tính là thu nhập mới.');
    } else {
      const tx = addTransaction({
        type: 'in',
        cat: 'hoan_tien',
        amount,
        date: getTodayDateString(),
        note: `${fullNote} → hũ NEC`,
        accountId: accountId || undefined,
        excludeFromReport: true,
      });
      updatePlus(prev => ({ cashbackToNec: { ...prev.cashbackToNec, [tx.id]: amount } }));
      showToast('success', `Đã cộng ${formatVND(amount)} vào hũ NEC`, 'Hũ Thiết yếu được tiêu thêm đúng số này; không tính là thu nhập mới.');
    }
    onClose();
  };

  const chip = (active: boolean) =>
    `min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
      active ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
    }`;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Gift size={18} className="text-emerald-600" />
          Nhận hoàn tiền / Voucher
        </span>
      }
      subtitle={`Thẻ ${card.name} · Dư nợ hiện tại ${formatVND(card.currentBalance)}`}
      footer={
        <button
          type="button"
          disabled={amount <= 0}
          onClick={handleSave}
          className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition-all cursor-pointer"
        >
          Ghi nhận {amount > 0 ? formatVND(amount) : ''}
        </button>
      }
    >
      <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1">
        <button type="button" className={chip(kind === 'cashback')} onClick={() => setKind('cashback')}>
          Hoàn tiền (Cashback)
        </button>
        <button type="button" className={chip(kind === 'voucher')} onClick={() => setKind('voucher')}>
          Voucher quy đổi
        </button>
      </div>

      <div>
        <label className={labelClass}>Số tiền (₫)</label>
        <input
          className={inputClass}
          inputMode="numeric"
          autoFocus
          value={amountStr}
          onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
          placeholder="VD: 150.000"
        />
      </div>

      <div>
        <label className={labelClass}>Dùng khoản này để</label>
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              { k: 'card', title: 'Trừ thẳng vào dư nợ thẻ', sub: 'Giảm số tiền phải trả ngân hàng' },
              { k: 'nec', title: 'Cộng vào hũ NEC', sub: 'Hũ Thiết yếu được tiêu thêm đúng số này' },
            ] as const
          ).map(opt => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setMode(opt.k)}
              className={`min-h-[56px] text-left px-3.5 py-2.5 rounded-2xl border transition-all cursor-pointer ${
                mode === opt.k
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              <p className="text-sm font-bold text-slate-900 dark:text-white">{opt.title}</p>
              <p className="text-[11px] text-slate-500">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {mode === 'nec' && (
        <div>
          <label className={labelClass}>Tiền về ví nào?</label>
          <select className={inputClass} value={accountId} onChange={e => setAccountId(e.target.value)}>
            <option value="">Không vào ví (voucher dùng trực tiếp)</option>
            {data.accts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Ghi chú (tuỳ chọn)</label>
        <input className={inputClass} value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Hoàn tiền tháng 11" />
      </div>

      <p className="text-[11px] text-slate-400">
        Khoản này luôn được đánh dấu "Không tính vào báo cáo" nên không bị tính nhầm là thu nhập mới.
      </p>
    </BottomSheet>
  );
};
