import React, { useEffect, useState } from 'react';
import { Check, Link2, PiggyBank } from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { calculateDepositAccrued, formatVND, formatVNDShort } from '../../utils/formatters';
import { showToast } from '../../utils/toast';

interface GoalFundModalProps {
  goalId: string | null;
  mode: 'contribute' | 'link';
  onClose: () => void;
  onReached?: () => void;
}

export const GoalFundModal: React.FC<GoalFundModalProps> = ({ goalId, mode, onClose, onReached }) => {
  const { data, contributeGoal } = useFinance();
  const { plus, updatePlus } = usePlus();
  const goal = data.goals.find(g => g.id === goalId);

  const [amountStr, setAmountStr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [linked, setLinked] = useState<string[]>([]);

  useEffect(() => {
    if (!goalId) return;
    setAmountStr('');
    setAccountId(data.accts.find(a => a.type === 'bank')?.id || data.accts[0]?.id || '');
    setLinked(plus.goalDepositLinks[goalId] || []);
  }, [goalId, mode]);

  if (!goal) return null;

  const ownerOf = (depId: string): string | undefined =>
    Object.entries(plus.goalDepositLinks).find(([gid, ids]) => gid !== goal.id && ids.includes(depId))?.[0];

  const activeDeps = data.deps.filter(d => !d.closed);
  const amount = parseCurrencyInput(amountStr);

  const handleContribute = () => {
    if (amount <= 0) return;
    contributeGoal(goal.id, amount, accountId || undefined);
    showToast('success', `Đã nạp ${formatVND(amount)} vào "${goal.title}"`);
    const linkedSum = (plus.goalDepositLinks[goal.id] || []).reduce((s, id) => {
      const d = data.deps.find(x => x.id === id && !x.closed);
      return s + (d ? d.amount + calculateDepositAccrued(d).accrued : 0);
    }, 0);
    if (goal.currentAmount + linkedSum < goal.targetAmount && goal.currentAmount + linkedSum + amount >= goal.targetAmount) {
      onReached?.();
    }
    onClose();
  };

  const handleSaveLinks = () => {
    updatePlus(prev => {
      const next: Record<string, string[]> = {};
      // Một sổ chỉ thuộc một quỹ: gỡ khỏi quỹ khác nếu vừa được chọn ở quỹ này
      Object.entries(prev.goalDepositLinks).forEach(([gid, ids]) => {
        if (gid === goal.id) return;
        const kept = ids.filter(id => !linked.includes(id));
        if (kept.length > 0) next[gid] = kept;
      });
      if (linked.length > 0) next[goal.id] = linked;
      return { goalDepositLinks: next };
    });
    showToast('success', `Đã cập nhật sổ tiết kiệm liên kết cho "${goal.title}"`);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={Boolean(goalId)}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {mode === 'contribute' ? <PiggyBank size={18} className="text-emerald-600" /> : <Link2 size={18} className="text-emerald-600" />}
          {mode === 'contribute' ? 'Nạp tiền vào quỹ' : 'Liên kết sổ tiết kiệm'}
        </span>
      }
      subtitle={goal.title}
      footer={
        mode === 'contribute' ? (
          <button
            type="button"
            disabled={amount <= 0}
            onClick={handleContribute}
            className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition-all cursor-pointer"
          >
            Nạp {amount > 0 ? formatVND(amount) : ''}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveLinks}
            className="w-full min-h-[46px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Check size={16} />
            Lưu liên kết ({linked.length} sổ)
          </button>
        )
      }
    >
      {mode === 'contribute' ? (
        <>
          <div>
            <label className={labelClass}>Số tiền nạp (₫)</label>
            <input
              className={inputClass}
              inputMode="numeric"
              autoFocus
              value={amountStr}
              onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
              placeholder="VD: 5.000.000"
            />
          </div>
          <div>
            <label className={labelClass}>Trích từ ví</label>
            <select className={inputClass} value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">Không trừ ví (chỉ cập nhật số đã có)</option>
              {data.accts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} · {formatVNDShort(a.balance)}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Khi trừ ví, app ghi một khoản "Tiết kiệm" (hũ LTS) để số dư ví luôn khớp thực tế.
            </p>
          </div>
        </>
      ) : activeDeps.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Bạn chưa có sổ tiết kiệm nào đang mở.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            Số dư (gốc + lãi tạm tính) của các sổ được chọn sẽ cộng thẳng vào tiến độ quỹ.
          </p>
          {activeDeps.map(d => {
            const checked = linked.includes(d.id);
            const owner = ownerOf(d.id);
            const ownerTitle = owner ? data.goals.find(g => g.id === owner)?.title : undefined;
            const { accrued } = calculateDepositAccrued(d);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setLinked(prev => (checked ? prev.filter(x => x !== d.id) : [...prev, d.id]))}
                className={`w-full min-h-[60px] text-left p-3 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                  checked
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                    checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {checked && <Check size={14} strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {d.bank} · {d.termMonths} tháng · {d.interestRate}%
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    Đáo hạn {d.maturityDate.split('-').reverse().join('/')}
                    {ownerTitle && !checked ? ` · đang thuộc "${ownerTitle}"` : ''}
                  </p>
                </div>
                <span className="money-mask text-sm font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                  {formatVNDShort(d.amount + accrued)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
};
