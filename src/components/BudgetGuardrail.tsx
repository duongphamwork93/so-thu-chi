import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { usePlus } from '../context/PlusContext';
import { TransactionType } from '../types/finance';
import { classifyJar, computeJarStatuses, DEFAULT_JARS, JAR_META } from '../utils/jars';
import { getPeriodMonthForDate, getPeriodRange } from '../utils/period';
import { formatVND, getTodayDateString } from '../utils/formatters';

export interface GuardrailState {
  applicable: boolean;
  jarCode: string;
  jarLabel: string;
  remainingAfter: number;
  over: boolean;
}

/**
 * Tính tức thì "hũ còn được tiêu bao nhiêu sau khoản này".
 * Phần nặng (quét giao dịch) chỉ chạy lại khi đổi danh mục / ngày; gõ số tiền chỉ là phép trừ.
 */
export function useBudgetGuardrail(params: {
  type: TransactionType;
  cat: string;
  amount: number;
  date?: string;
  /** Mã giao dịch đang sửa (bỏ khỏi phần đã chi để không trừ 2 lần) */
  excludeTxId?: string;
}): GuardrailState {
  const { data, categoryMap } = useFinance();
  const { plus } = usePlus();
  const { type, cat, amount, excludeTxId } = params;
  const date = params.date || getTodayDateString();
  const jarKey = type === 'out' ? classifyJar({ cat, note: '' }, categoryMap) : null;
  const periodMonth = getPeriodMonthForDate(date, plus.periodMode, plus.payrollStartDay);

  const remainingBefore = useMemo(() => {
    if (!jarKey) return null;
    const range = getPeriodRange(periodMonth, plus.periodMode, plus.payrollStartDay);
    const status = computeJarStatuses({
      records: excludeTxId ? data.records.filter(r => r.id !== excludeTxId) : data.records,
      range,
      todayStr: getTodayDateString(),
      jarTargets: data.settings.jarTargets || DEFAULT_JARS,
      monthlyIncome: plus.monthlyIncome,
      categoryMap,
      cashbackToNec: plus.cashbackToNec,
    }).find(j => j.key === jarKey);
    return status ? status.remaining : null;
  }, [jarKey, periodMonth, data.records, data.settings.jarTargets, plus, categoryMap, excludeTxId]);

  if (!jarKey || remainingBefore === null) {
    return { applicable: false, jarCode: '', jarLabel: '', remainingAfter: 0, over: false };
  }
  const remainingAfter = remainingBefore - Math.max(0, amount || 0);
  return {
    applicable: true,
    jarCode: JAR_META[jarKey].code,
    jarLabel: JAR_META[jarKey].label,
    remainingAfter,
    over: amount > 0 && remainingAfter < 0,
  };
}

export const BudgetGuardrailNote: React.FC<{ state: GuardrailState; amount: number }> = ({ state, amount }) => {
  if (!state.applicable || !(amount > 0)) return null;
  if (!state.over) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 px-1" aria-live="polite">
        <CheckCircle2 size={14} className="shrink-0" />
        <span>
          Hũ {state.jarCode} ({state.jarLabel}) còn được tiêu:{' '}
          <strong className="money-mask">{formatVND(state.remainingAfter)}</strong>
        </span>
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="p-3 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 text-xs sm:text-sm text-orange-800 dark:text-orange-200 flex items-start gap-2"
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-orange-600" />
      <span>
        <strong>Cảnh báo:</strong> Khoản này làm hũ <strong>{state.jarCode}</strong> ({state.jarLabel}) vượt ngân sách{' '}
        <strong className="money-mask text-rose-600 dark:text-rose-400">{formatVND(-state.remainingAfter)}</strong> (có nguy cơ ăn
        lẹm vào tiền tiết kiệm tháng này!)
      </span>
    </div>
  );
};

/** Dạng gọn: tự tính và hiển thị (dùng trong danh sách hoá đơn / giọng nói). */
export const BudgetGuardrail: React.FC<{ type: TransactionType; cat: string; amount: number; date?: string }> = props => {
  const state = useBudgetGuardrail(props);
  return <BudgetGuardrailNote state={state} amount={props.amount} />;
};
