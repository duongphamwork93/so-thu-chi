import React, { useEffect, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { BottomSheet, inputClass, labelClass } from '../ui/BottomSheet';
import { useFinance } from '../../context/FinanceContext';
import { usePlus } from '../../context/PlusContext';
import { JarTargets } from '../../types/finance';
import { DEFAULT_JARS, JAR_META, JAR_ORDER } from '../../utils/jars';
import { formatCurrencyInput, parseCurrencyInput } from '../../utils/numberFormatters';
import { formatVND, formatVNDShort } from '../../utils/formatters';
import { DEFAULT_MONTHLY_INCOME } from '../../types/plus';

interface JarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JarSettingsModal: React.FC<JarSettingsModalProps> = ({ isOpen, onClose }) => {
  const { data, updateSettings } = useFinance();
  const { plus, updatePlus } = usePlus();

  const [incomeStr, setIncomeStr] = useState('');
  const [draft, setDraft] = useState<JarTargets>(DEFAULT_JARS);
  const [payrollDay, setPayrollDay] = useState('30');

  useEffect(() => {
    if (!isOpen) return;
    setIncomeStr(formatCurrencyInput(plus.monthlyIncome || DEFAULT_MONTHLY_INCOME));
    setDraft(data.settings.jarTargets || DEFAULT_JARS);
    setPayrollDay(String(plus.payrollStartDay || 30));
  }, [isOpen]);

  const income = parseCurrencyInput(incomeStr);
  const sum = JAR_ORDER.reduce((s, k) => s + (draft[k] || 0), 0);
  const canSave = sum === 100 && income > 0;

  const handleSave = () => {
    if (!canSave) return;
    const day = Math.min(31, Math.max(1, Number(payrollDay) || 30));
    updatePlus({ monthlyIncome: income, payrollStartDay: day });
    const prev = data.settings.jarTargets || DEFAULT_JARS;
    if (JAR_ORDER.some(k => prev[k] !== draft[k]) || !data.settings.jarTargets) {
      updateSettings({ jarTargets: draft });
    }
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Thiết lập ngân sách 6 Hũ"
      subtitle="Mỗi hũ có trần chi tiêu cố định = Thu nhập định mức × %"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft(DEFAULT_JARS)}
            className="min-h-[42px] px-3 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Mặc định</span>
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="min-h-[44px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Check size={16} />
            <span>Lưu thiết lập</span>
          </button>
        </div>
      }
    >
      <div>
        <label className={labelClass}>Thu nhập định mức tháng (₫)</label>
        <input
          type="text"
          inputMode="numeric"
          value={incomeStr}
          onChange={e => setIncomeStr(formatCurrencyInput(e.target.value))}
          placeholder="48.000.000"
          className={inputClass}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Dùng làm trần cố định cho cả tháng — không phụ thuộc lương đã về hay chưa.
        </p>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-800 dark:text-slate-100">Tỷ lệ % từng hũ</span>
        <span className={`font-extrabold tabular-nums ${sum === 100 ? 'text-emerald-600' : 'text-rose-500'}`}>
          Tổng: {sum}% / 100%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {JAR_ORDER.map(k => {
          const meta = JAR_META[k];
          const budget = Math.round((income * (draft[k] || 0)) / 100);
          return (
            <div key={k} className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black text-white" style={{ backgroundColor: meta.color }}>
                  {meta.code}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">{meta.label}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={draft[k]}
                  onChange={e =>
                    setDraft(prev => ({ ...prev, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))
                  }
                  className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white pr-7 tabular-nums"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
              </div>
              <p className="money-mask text-[11px] text-slate-500 mt-1 tabular-nums">= {formatVNDShort(budget)}/tháng</p>
            </div>
          );
        })}
      </div>

      <div>
        <label className={labelClass}>Ngày bắt đầu kỳ lương</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={payrollDay}
          onChange={e => setPayrollDay(e.target.value)}
          className={inputClass}
        />
        <p className="text-[11px] text-slate-400 mt-1">
          {(Number(payrollDay) || 30) <= 1
            ? 'Ngày 1 = kỳ lương trùng với tháng dương lịch.'
            : `Bộ lọc "Kỳ lương" sẽ tính từ ngày ${Number(payrollDay) || 30} tháng trước đến ngày ${
                (Number(payrollDay) || 30) - 1
              } tháng này (tự co về cuối tháng nếu tháng ngắn hơn).`}
        </p>
      </div>

      {income > 0 && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Tổng ngân sách 6 hũ: <strong className="money-mask">{formatVND(income)}</strong>
        </p>
      )}
    </BottomSheet>
  );
};
