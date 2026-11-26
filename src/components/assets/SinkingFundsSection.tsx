import React, { useMemo, useState } from 'react';
import { CalendarClock, Edit3, Link2, Plus, Target, Trash2 } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { SavingsGoal } from '../../types/finance';
import { calculateDepositAccrued, formatVND, formatVNDShort, getTodayDateString } from '../../utils/formatters';
import { countPaydaysBetween, diffDays } from '../../utils/period';
import { GoalFundModal } from '../modals/GoalFundModal';

interface SinkingFundsSectionProps {
  onAddGoal: () => void;
  onEditGoal: (goal: SavingsGoal) => void;
  onCelebrate: () => void;
}

export const SinkingFundsSection: React.FC<SinkingFundsSectionProps> = ({ onAddGoal, onEditGoal, onCelebrate }) => {
  const { data, deleteGoal } = useFinance();
  const { plus, updatePlus, paydayPlans } = usePlus();
  const [fundModal, setFundModal] = useState<{ goalId: string; mode: 'contribute' | 'link' } | null>(null);

  const todayStr = getTodayDateString();
  const paydayDays = useMemo(() => Array.from(new Set(paydayPlans.map(p => p.day))), [paydayPlans]);

  const funds = useMemo(
    () =>
      data.goals.map(goal => {
        const linkedDeps = (plus.goalDepositLinks[goal.id] || [])
          .map(id => data.deps.find(d => d.id === id && !d.closed))
          .filter((d): d is NonNullable<typeof d> => Boolean(d));
        const linkedSum = linkedDeps.reduce((s, d) => s + d.amount + calculateDepositAccrued(d).accrued, 0);
        const total = goal.currentAmount + linkedSum;
        const missing = Math.max(0, goal.targetAmount - total);
        const pct = goal.targetAmount > 0 ? Math.round((total / goal.targetAmount) * 100) : 0;
        const hasDate = Boolean(goal.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate));
        const daysLeft = hasDate ? diffDays(todayStr, goal.targetDate!) : null;
        const paydaysLeft = hasDate ? countPaydaysBetween(paydayDays, todayStr, goal.targetDate!) : 0;
        const perPayday = missing > 0 && paydaysLeft > 0 ? Math.ceil(missing / paydaysLeft / 1000) * 1000 : 0;
        return { goal, linkedDeps, linkedSum, total, missing, pct, daysLeft, paydaysLeft, perPayday, hasDate };
      }),
    [data.goals, data.deps, plus.goalDepositLinks, paydayDays, todayStr]
  );

  const totalSaved = funds.reduce((s, f) => s + f.total, 0);
  const totalTarget = funds.reduce((s, f) => s + f.goal.targetAmount, 0);

  const handleDelete = (goal: SavingsGoal) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa quỹ "${goal.title}" không?`)) return;
    deleteGoal(goal.id);
    updatePlus(prev => {
      const next = { ...prev.goalDepositLinks };
      delete next[goal.id];
      return { goalDepositLinks: next };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Quỹ mục tiêu ({data.goals.length})
          </span>
          {totalTarget > 0 && (
            <span className="text-[11px] text-slate-400">
              Đã có <span className="money-mask font-semibold">{formatVNDShort(totalSaved)}</span> /{' '}
              <span className="money-mask">{formatVNDShort(totalTarget)}</span> · độc lập với 6 hũ hàng tháng
            </span>
          )}
        </div>
        <button
          onClick={onAddGoal}
          className="min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white flex items-center gap-1.5 hover:bg-emerald-700 shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={14} />
          <span>Quỹ mới</span>
        </button>
      </div>

      {funds.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
          Tạo quỹ cho các khoản lớn sắp tới (VD: <strong>Quỹ Tết đưa bà & nội ngoại</strong>,{' '}
          <strong>Quỹ mua Nhà & Ô tô</strong>) để biết mỗi kỳ lương cần trích bao nhiêu.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {funds.map(f => {
          const { goal } = f;
          const isDone = f.pct >= 100;
          const overdue = f.daysLeft !== null && f.daysLeft < 0 && !isDone;
          return (
            <div
              key={goal.id}
              className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                    <Target size={20} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{goal.title}</h4>
                    <p className={`text-[11px] flex items-center gap-1 ${overdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                      <CalendarClock size={11} />
                      {f.hasDate
                        ? `Đích ${goal.targetDate!.split('-').reverse().join('/')} · ${
                            f.daysLeft! >= 0 ? `còn ${f.daysLeft} ngày` : `quá hạn ${-f.daysLeft!} ngày`
                          }`
                        : 'Chưa đặt ngày đích'}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-black tabular-nums shrink-0 ${isDone ? 'text-emerald-600' : 'text-slate-800 dark:text-slate-100'}`}>
                  {f.pct}%
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1 tabular-nums">
                  <span>
                    Đã có <span className="money-mask font-bold text-slate-900 dark:text-white">{formatVND(f.total)}</span>
                  </span>
                  <span>
                    / <span className="money-mask">{formatVNDShort(goal.targetAmount)}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${Math.min(100, f.pct)}%` }}
                  />
                </div>
                {f.linkedDeps.length > 0 && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Gồm <span className="money-mask">{formatVNDShort(goal.currentAmount)}</span> nạp tay +{' '}
                    <span className="money-mask">{formatVNDShort(f.linkedSum)}</span> từ {f.linkedDeps.length} sổ tiết kiệm
                  </p>
                )}
              </div>

              {!isDone && (
                <div className="px-3 py-2 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 text-[11px] text-emerald-900 dark:text-emerald-200">
                  {f.perPayday > 0 ? (
                    <>
                      Cần trích thêm <strong className="money-mask">{formatVND(f.perPayday)}</strong> / kỳ lương ({f.paydaysLeft} kỳ
                      còn lại) để đạt mục tiêu.
                    </>
                  ) : f.hasDate && f.missing > 0 ? (
                    <>
                      Không còn kỳ lương nào trước ngày đích — còn thiếu{' '}
                      <strong className="money-mask">{formatVND(f.missing)}</strong>.
                    </>
                  ) : (
                    <>
                      Còn thiếu <strong className="money-mask">{formatVND(f.missing)}</strong>. Đặt ngày đích để biết mỗi kỳ cần trích bao nhiêu.
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onEditGoal(goal)}
                  className="min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                  title="Sửa quỹ"
                  aria-label="Sửa quỹ"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(goal)}
                  className="min-h-[40px] rounded-xl bg-rose-50/80 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
                  title="Xoá quỹ"
                  aria-label="Xoá quỹ"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setFundModal({ goalId: goal.id, mode: 'link' })}
                  className="min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  title="Liên kết sổ tiết kiệm"
                >
                  <Link2 size={14} />
                  <span>Sổ TK</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFundModal({ goalId: goal.id, mode: 'contribute' })}
                  className="min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold active:scale-95 transition-all cursor-pointer"
                >
                  + Nạp
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <GoalFundModal
        goalId={fundModal?.goalId || null}
        mode={fundModal?.mode || 'contribute'}
        onClose={() => setFundModal(null)}
        onReached={onCelebrate}
      />
    </div>
  );
};
