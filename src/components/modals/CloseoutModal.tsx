import React, { useEffect, useMemo, useState } from 'react';
import { Check, PiggyBank } from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { computeIncomeBuffer } from '../../utils/incomeBuffer';
import { calculateDepositAccrued, formatVND, getTodayDateString } from '../../utils/formatters';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { showToast } from '../../utils/toast';

interface CloseoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CHỐT SỔ CUỐI KỲ: gom tiền mặt dư trong ví thanh toán (sau khi giữ vùng đệm dự phòng)
 * sang Quỹ mục tiêu hoặc tài khoản tiết kiệm. Đây là chuyển tiền tích luỹ, không phải chi tiêu tiêu dùng.
 */
export const CloseoutModal: React.FC<CloseoutModalProps> = ({ isOpen, onClose }) => {
  const { data, categoryMap, contributeGoal, transferMoney } = useFinance();
  const { plus } = usePlus();
  const todayStr = getTodayDateString();
  const buffer = useMemo(() => computeIncomeBuffer({ data, plus, categoryMap, todayStr }), [data, plus, categoryMap, todayStr]);

  const [fromId, setFromId] = useState('');
  const [dest, setDest] = useState('');
  const [amountStr, setAmountStr] = useState('');

  const fromAcc = data.accts.find(a => a.id === fromId);
  // Quỹ dự phòng tối thiểu = vùng đệm chờ lương giữa tháng (nếu đang trong giai đoạn đó)
  const reserve = fromId === buffer.accountId && buffer.active ? buffer.required : 0;
  const suggested = Math.max(0, Math.floor(((fromAcc?.balance || 0) - reserve) / 100_000) * 100_000);

  useEffect(() => {
    if (!isOpen) return;
    const from = buffer.accountId || data.accts[0]?.id || '';
    setFromId(from);
    const tet = data.goals.find(g => g.title.toLowerCase().includes('tết'));
    setDest(tet ? `goal:${tet.id}` : data.goals[0] ? `goal:${data.goals[0].id}` : '');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setAmountStr(suggested > 0 ? formatCurrencyInput(suggested) : '');
  }, [isOpen, fromId, suggested]);

  const amount = parseCurrencyInput(amountStr);
  const destGoal = dest.startsWith('goal:') ? data.goals.find(g => `goal:${g.id}` === dest) : undefined;
  const destAcc = dest.startsWith('acc:') ? data.accts.find(a => `acc:${a.id}` === dest) : undefined;
  const goalProgress = (goalId: string) => {
    const g = data.goals.find(x => x.id === goalId);
    if (!g) return '';
    const linked = (plus.goalDepositLinks[goalId] || []).reduce((s, id) => {
      const d = data.deps.find(x => x.id === id && !x.closed);
      return s + (d ? d.amount + calculateDepositAccrued(d).accrued : 0);
    }, 0);
    return `${formatVND(g.currentAmount + linked)} / ${formatVND(g.targetAmount)}`;
  };

  const canSave = amount > 0 && fromAcc && amount <= fromAcc.balance && (destGoal || (destAcc && destAcc.id !== fromId));

  const confirm = () => {
    if (!canSave || !fromAcc) return;
    const note = `Chốt sổ cuối kỳ → ${destGoal ? destGoal.title : destAcc!.name}`;
    if (destGoal) contributeGoal(destGoal.id, amount, fromAcc.id, note);
    else if (destAcc) transferMoney(fromAcc.id, destAcc.id, amount, note);
    showToast('success', `Đã chốt sổ: chuyển ${formatVND(amount)}`, `${fromAcc.name} → ${destGoal ? destGoal.title : destAcc!.name}`);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <PiggyBank size={18} className="text-emerald-600" /> Chốt sổ cuối kỳ
        </span>
      }
      subtitle="Gom tiền mặt dư sang tích luỹ, bắt đầu kỳ lương mới gọn gàng"
      footer={
        <button
          type="button"
          disabled={!canSave}
          onClick={confirm}
          className="w-full min-h-[48px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <Check size={16} /> Xác nhận chốt sổ {amount > 0 ? formatVND(amount) : ''}
        </button>
      }
    >
      <div>
        <label className={labelClass}>Lấy tiền từ ví</label>
        <select className={inputClass} value={fromId} onChange={e => setFromId(e.target.value)}>
          {data.accts.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">Tiền mặt đang có trong {fromAcc?.name}</span>
          <strong className="money-mask tabular-nums">{formatVND(fromAcc?.balance || 0)}</strong>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">
            Giữ lại dự phòng{reserve > 0 ? ` (vùng đệm đến ${buffer.bufferEnd.slice(8, 10)}/${buffer.bufferEnd.slice(5, 7)})` : ''}
          </span>
          <strong className="money-mask tabular-nums text-amber-600">− {formatVND(reserve)}</strong>
        </div>
        <div className="flex justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
          <span className="font-semibold text-slate-700 dark:text-slate-200">Có thể chốt sang tích luỹ</span>
          <strong className="money-mask tabular-nums text-emerald-600">{formatVND(suggested)}</strong>
        </div>
      </div>

      <div>
        <label className={labelClass}>Số tiền chốt chuyển sang tiết kiệm (₫)</label>
        <input
          className={inputClass}
          inputMode="numeric"
          value={amountStr}
          onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
          placeholder="0"
        />
        {fromAcc && amount > fromAcc.balance && (
          <p className="text-[11px] text-rose-500 mt-1">Vượt quá số dư {fromAcc.name}.</p>
        )}
        {amount > suggested && fromAcc && amount <= fromAcc.balance && reserve > 0 && (
          <p className="text-[11px] text-amber-600 mt-1">Lưu ý: số này lẹm vào vùng đệm dự phòng.</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Chuyển vào</label>
        <div className="space-y-1.5">
          {data.goals.map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => setDest(`goal:${g.id}`)}
              className={`w-full min-h-[52px] text-left px-3 py-2 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer ${
                dest === `goal:${g.id}` ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">🎯 {g.title}</span>
                <span className="block text-[11px] text-slate-500 money-mask">{goalProgress(g.id)}</span>
              </span>
              {dest === `goal:${g.id}` && <Check size={16} className="text-emerald-600 shrink-0" />}
            </button>
          ))}
          {data.accts
            .filter(a => a.id !== fromId)
            .map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setDest(`acc:${a.id}`)}
                className={`w-full min-h-[48px] text-left px-3 py-2 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer ${
                  dest === `acc:${a.id}` ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">🏦 Chuyển sang {a.name}</span>
                {dest === `acc:${a.id}` && <Check size={16} className="text-emerald-600 shrink-0" />}
              </button>
            ))}
          {data.goals.length === 0 && (
            <p className="text-[11px] text-slate-500">Chưa có Quỹ mục tiêu — tạo ở tab Tài sản → Quỹ mục tiêu.</p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        Nạp quỹ được ghi vào hũ LTS (tích luỹ), không tính vào chi tiêu tiêu dùng NEC/PLAY/EDUC. Chuyển giữa 2 ví là chuyển nội bộ, không phải chi tiêu.
      </p>
    </BottomSheet>
  );
};
