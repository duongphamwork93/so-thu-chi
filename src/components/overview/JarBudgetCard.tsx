import React, { useMemo, useState } from 'react';
import { Gauge, HandCoins, Layers, SlidersHorizontal } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { computeJarStatuses, DEFAULT_JARS } from '../../utils/jars';
import { formatVND, formatVNDShort, getTodayDateString } from '../../utils/formatters';
import { latestPaydayDate } from '../../utils/period';
import { JarSettingsModal } from '../modals/JarSettingsModal';
import { PaydayChecklistModal, paydayDoneKey } from '../modals/PaydayChecklistModal';

interface JarBudgetCardProps {
  onOpenJarReport?: () => void;
}

export const JarBudgetCard: React.FC<JarBudgetCardProps> = ({ onOpenJarReport }) => {
  const { data, categoryMap } = useFinance();
  const { plus, periodRange, paydayPlans } = usePlus();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaydayOpen, setIsPaydayOpen] = useState(false);

  const todayStr = getTodayDateString();
  const jars = useMemo(
    () =>
      computeJarStatuses({
        records: data.records,
        range: periodRange,
        todayStr,
        jarTargets: data.settings.jarTargets || DEFAULT_JARS,
        monthlyIncome: plus.monthlyIncome,
        categoryMap,
        cashbackToNec: plus.cashbackToNec,
      }),
    [data.records, periodRange, todayStr, data.settings.jarTargets, plus.monthlyIncome, categoryMap, plus.cashbackToNec]
  );

  // Kỳ lương vừa diễn ra trong 5 ngày gần đây mà còn khoản chưa tick → nhắc nhở
  const pendingPayday = useMemo(() => {
    for (const plan of paydayPlans) {
      const pd = latestPaydayDate(plan.day, todayStr);
      const daysSince = Math.round((Date.parse(todayStr) - Date.parse(pd)) / 86_400_000);
      if (daysSince > 5) continue;
      const left = plan.items.filter(it => !plus.paydayDone[paydayDoneKey(plan.id, it.id, pd)]);
      if (left.length > 0) {
        return { plan, left: left.length, amount: left.reduce((s, it) => s + it.amount, 0) };
      }
    }
    return null;
  }, [paydayPlans, plus.paydayDone, todayStr]);

  const variable = jars.filter(j => j.isVariable);
  const variableRemaining = variable.reduce((s, j) => s + j.remaining, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Ngân Sách 6 Hũ
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {periodRange.label} ({periodRange.rangeLabel}) · Trần theo{' '}
              <span className="money-mask">{formatVNDShort(plus.monthlyIncome)}</span>/tháng
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="min-h-[44px] px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <SlidersHorizontal size={15} />
          <span>Thiết lập %</span>
        </button>
        <button
          type="button"
          onClick={() => setIsPaydayOpen(true)}
          className="relative min-h-[44px] px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
        >
          <HandCoins size={15} />
          <span>Chia tiền lương</span>
          {pendingPayday && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
              {pendingPayday.left}
            </span>
          )}
        </button>
      </div>

      {pendingPayday && (
        <button
          type="button"
          onClick={() => setIsPaydayOpen(true)}
          className="w-full text-left p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 cursor-pointer"
        >
          💰 Lương <strong>{pendingPayday.plan.name}</strong> đã về — còn {pendingPayday.left} khoản cần trích (
          <span className="money-mask font-bold">{formatVNDShort(pendingPayday.amount)}</span>). Chạm để làm ngay.
        </button>
      )}

      <div className="flex items-center justify-between px-0.5 text-xs">
        <span className="text-slate-500 dark:text-slate-400">Còn được tiêu (NEC + PLAY):</span>
        <span
          className={`money-mask font-extrabold tabular-nums ${
            variableRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
          }`}
        >
          {formatVND(variableRemaining)}
        </span>
      </div>

      <div className="space-y-2.5">
        {jars.map(j => {
          const over = j.remaining < 0;
          const barColor = over ? '#F43F5E' : j.usedPct >= 80 ? '#F59E0B' : j.color;
          return (
            <div key={j.key} className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white shrink-0"
                    style={{ backgroundColor: j.color }}
                  >
                    {j.code}
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{j.label}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{j.targetPct}%</span>
                  {j.isFast && (
                    <span className="px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                      <Gauge size={10} />
                      Đang tiêu hơi nhanh
                    </span>
                  )}
                  {over && j.isVariable && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0">
                      Vượt trần
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-500 tabular-nums shrink-0">{j.usedPct}%</span>
              </div>

              <div className="relative h-2.5 mt-2 w-full bg-slate-200/80 dark:bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, j.usedPct)}%`, backgroundColor: barColor }}
                />
                {j.isVariable && j.elapsedPct > 0 && j.elapsedPct < 100 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50 dark:bg-white/70"
                    style={{ left: `${j.elapsedPct}%` }}
                    title={`Đã qua ${j.elapsedPct}% thời gian của kỳ`}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] tabular-nums">
                <span className="text-slate-500 dark:text-slate-400">
                  Đã chi: <span className="money-mask font-semibold text-slate-700 dark:text-slate-200">{formatVND(j.spent)}</span>
                </span>
                <span className={over ? 'text-rose-500 font-bold' : 'text-emerald-700 dark:text-emerald-300'}>
                  {over ? 'Vượt: ' : 'Còn được tiêu: '}
                  <strong className="money-mask">{formatVND(Math.abs(j.remaining))}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {onOpenJarReport && (
        <button
          type="button"
          onClick={onOpenJarReport}
          className="w-full text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
        >
          Xem chi tiết từng khoản trong hũ ›
        </button>
      )}

      <JarSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <PaydayChecklistModal isOpen={isPaydayOpen} onClose={() => setIsPaydayOpen(false)} />
    </div>
  );
};
